/** Fluxo de caixa e DRE (cálculos puros, testáveis). */

export type Granularity = "day" | "week" | "month";

/** Início do período (AAAA-MM-DD) a que a data pertence. Semana começa na segunda. */
export function bucketOf(date: string, granularity: Granularity): string {
  if (granularity === "day") return date;
  if (granularity === "month") return `${date.slice(0, 7)}-01`;
  const d = new Date(`${date}T00:00:00Z`);
  const weekday = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (weekday === 0 ? 6 : weekday - 1));
  return d.toISOString().slice(0, 10);
}

export type FlowRow = { bucket: string; realizedIn: number; realizedOut: number; expectedIn: number; expectedOut: number; balance: number };

/**
 * Realizado = movimentos do caixa; previsto = contas a receber e a pagar em
 * aberto pelo vencimento. Saldo acumulado considera realizado + previsto.
 */
export function cashFlow(
  input: {
    movements: { date: string; type: "in" | "out"; amountCents: number }[];
    receivables: { dueDate: string; amountCents: number }[];
    payables: { dueDate: string; amountCents: number }[];
  },
  granularity: Granularity,
): FlowRow[] {
  const rows = new Map<string, FlowRow>();
  const row = (date: string) => {
    const key = bucketOf(date, granularity);
    let r = rows.get(key);
    if (!r) {
      r = { bucket: key, realizedIn: 0, realizedOut: 0, expectedIn: 0, expectedOut: 0, balance: 0 };
      rows.set(key, r);
    }
    return r;
  };
  for (const m of input.movements) {
    if (m.type === "in") row(m.date).realizedIn += m.amountCents;
    else row(m.date).realizedOut += m.amountCents;
  }
  for (const r of input.receivables) row(r.dueDate).expectedIn += r.amountCents;
  for (const p of input.payables) row(p.dueDate).expectedOut += p.amountCents;
  let running = 0;
  return [...rows.values()]
    .sort((a, b) => a.bucket.localeCompare(b.bucket))
    .map((r) => {
      running += r.realizedIn - r.realizedOut + r.expectedIn - r.expectedOut;
      return { ...r, balance: running };
    });
}

export type DreInput = {
  revenue: { amountCents: number; feeCents: number }[];
  expenses: { category: string; amountCents: number }[];
};

export type Dre = { grossRevenue: number; fees: number; netRevenue: number; expenses: { category: string; amountCents: number }[]; totalExpenses: number; result: number };

/** DRE gerencial: receita bruta − taxas = receita líquida; − despesas por categoria = resultado. */
export function buildDre({ revenue, expenses }: DreInput): Dre {
  const grossRevenue = revenue.reduce((s, r) => s + r.amountCents, 0);
  const fees = revenue.reduce((s, r) => s + r.feeCents, 0);
  const byCategory = new Map<string, number>();
  for (const e of expenses) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amountCents);
  const list = [...byCategory.entries()].map(([category, amountCents]) => ({ category, amountCents })).sort((a, b) => b.amountCents - a.amountCents);
  const totalExpenses = list.reduce((s, e) => s + e.amountCents, 0);
  return { grossRevenue, fees, netRevenue: grossRevenue - fees, expenses: list, totalExpenses, result: grossRevenue - fees - totalExpenses };
}
