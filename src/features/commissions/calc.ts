/**
 * Cálculo de comissões (puro, testável).
 *
 * Regra aplicada a um procedimento, nesta ordem: exceção do procedimento
 * (percentual ou valor fixo) → exceção da categoria → percentual padrão do
 * profissional → zero.
 *
 * Base "executado": itens realizados no mês, com o desconto do orçamento
 * rateado entre os itens aprovados.
 * Base "recebido": cada pagamento do mês é rateado entre os itens aprovados do
 * orçamento, na proporção do valor líquido de cada item; cobrança sem
 * orçamento usa o percentual padrão.
 */

export type Rule = { procedureId: string | null; category: string | null; percent: number | null; fixedCents: number | null };

export type Settings = { base: "received" | "executed"; deductFees: boolean; deductLab: boolean };

export type PlanItem = {
  id: string;
  description: string;
  procedureId: string | null;
  category: string | null;
  priceCents: number;
  labCostCents: number;
  status: "approved" | "done" | "pending" | "rejected";
  doneAt: string | null;
};

export type Plan = { id: string; discountCents: number; items: PlanItem[] };

export type Payment = {
  id: string;
  date: string;
  patientName: string;
  description: string;
  paidCents: number;
  feeCents: number;
  planId: string | null;
};

export type Line = {
  date: string;
  patientName: string;
  description: string;
  grossCents: number;
  feeCents: number;
  labCents: number;
  baseCents: number;
  rule: string;
  commissionCents: number;
};

function resolveRule(rules: Rule[], defaultPercent: number, item: { procedureId: string | null; category: string | null }) {
  const byProcedure = item.procedureId ? rules.find((r) => r.procedureId === item.procedureId) : undefined;
  if (byProcedure) return byProcedure;
  const byCategory = item.category ? rules.find((r) => r.category === item.category) : undefined;
  if (byCategory) return byCategory;
  return { procedureId: null, category: null, percent: defaultPercent, fixedCents: null } satisfies Rule;
}

const pct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

/** Valor líquido de cada item aprovado (desconto do orçamento rateado). */
export function netItemValues(plan: Plan): Map<string, number> {
  const approved = plan.items.filter((i) => i.status === "approved" || i.status === "done");
  const total = approved.reduce((s, i) => s + i.priceCents, 0);
  const result = new Map<string, number>();
  if (!total) return result;
  let allocated = 0;
  approved.forEach((item, index) => {
    const share = index === approved.length - 1 ? plan.discountCents - allocated : Math.round((plan.discountCents * item.priceCents) / total);
    allocated += share;
    result.set(item.id, item.priceCents - share);
  });
  return result;
}

function commissionFor(rule: Rule, baseCents: number, fraction: number) {
  if (rule.fixedCents !== null) return { cents: Math.round(rule.fixedCents * fraction), label: `fixo ${(rule.fixedCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` };
  const percent = rule.percent ?? 0;
  return { cents: Math.round((Math.max(baseCents, 0) * percent) / 100), label: pct(percent) };
}

export function computeStatement(input: {
  settings: Settings;
  defaultPercent: number;
  rules: Rule[];
  plans: Plan[];
  /** Base recebido: pagamentos do mês do profissional. */
  payments: Payment[];
  /** Base executado: [plano, paciente] para itens realizados no mês. */
  executed: { planId: string; patientName: string }[];
  month: string; // AAAA-MM
}): { lines: Line[]; grossCents: number; baseCents: number; commissionCents: number } {
  const { settings, defaultPercent, rules } = input;
  const plans = new Map(input.plans.map((p) => [p.id, p]));
  const lines: Line[] = [];

  if (settings.base === "executed") {
    for (const ref of input.executed) {
      const plan = plans.get(ref.planId);
      if (!plan) continue;
      const net = netItemValues(plan);
      for (const item of plan.items) {
        if (item.status !== "done" || !item.doneAt?.startsWith(input.month)) continue;
        const gross = net.get(item.id) ?? item.priceCents;
        const lab = settings.deductLab ? item.labCostCents : 0;
        const base = gross - lab;
        const rule = resolveRule(rules, defaultPercent, item);
        const c = commissionFor(rule, base, 1);
        lines.push({ date: item.doneAt.slice(0, 10), patientName: ref.patientName, description: item.description, grossCents: gross, feeCents: 0, labCents: lab, baseCents: base, rule: c.label, commissionCents: c.cents });
      }
    }
  } else {
    for (const payment of input.payments) {
      const fee = settings.deductFees ? payment.feeCents : 0;
      const plan = payment.planId ? plans.get(payment.planId) : undefined;
      const net = plan ? netItemValues(plan) : new Map<string, number>();
      const planTotal = [...net.values()].reduce((s, v) => s + v, 0);
      if (!plan || !planTotal) {
        const base = payment.paidCents - fee;
        const c = commissionFor({ procedureId: null, category: null, percent: defaultPercent, fixedCents: null }, base, 1);
        lines.push({ date: payment.date, patientName: payment.patientName, description: payment.description, grossCents: payment.paidCents, feeCents: fee, labCents: 0, baseCents: base, rule: c.label, commissionCents: c.cents });
        continue;
      }
      // Parte do pagamento que cabe a cada item; o último leva o arredondamento.
      const items = plan.items.filter((i) => net.has(i.id));
      let paidLeft = payment.paidCents;
      let feeLeft = fee;
      items.forEach((item, index) => {
        const value = net.get(item.id)!;
        const fraction = value / planTotal;
        const last = index === items.length - 1;
        const gross = last ? paidLeft : Math.round(payment.paidCents * fraction);
        const itemFee = last ? feeLeft : Math.round(fee * fraction);
        paidLeft -= gross;
        feeLeft -= itemFee;
        // Custo de laboratório também proporcional ao quanto do item foi pago agora.
        const lab = settings.deductLab ? Math.round(item.labCostCents * (gross / value)) : 0;
        const base = gross - itemFee - lab;
        const rule = resolveRule(rules, defaultPercent, item);
        const c = commissionFor(rule, base, gross / value);
        lines.push({ date: payment.date, patientName: payment.patientName, description: `${item.description} (${payment.description})`, grossCents: gross, feeCents: itemFee, labCents: lab, baseCents: base, rule: c.label, commissionCents: c.cents });
      });
    }
  }

  lines.sort((a, b) => a.date.localeCompare(b.date));
  return {
    lines,
    grossCents: lines.reduce((s, l) => s + l.grossCents, 0),
    baseCents: lines.reduce((s, l) => s + l.baseCents, 0),
    commissionCents: lines.reduce((s, l) => s + l.commissionCents, 0),
  };
}
