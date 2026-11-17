/** Pendências de configuração mostradas no topo de Configurações. */
export type SettingsTodo = { text: string; href: string };

type Summary = { units: number; chairs: number; professionals: number; procedures: number; paymentMethods: number; unpriced: number };
type Plan = { planId: string | null; status: string; trialEndsAt: string | null };

const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function shortDate(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(iso));
}

/** Só o que impede ou atrapalha o uso: cada item leva à tela que resolve. */
export function settingsTodo(summary: Summary | null, plan: Plan | null): SettingsTodo[] {
  const list: SettingsTodo[] = [];
  if (plan?.status === "past_due") list.push({ text: "A assinatura está com pagamento em atraso", href: "/configuracoes/assinatura" });
  else if (plan && !plan.planId && plan.status === "trialing")
    list.push({
      text: plan.trialEndsAt ? `Escolha um plano: o teste grátis vai até ${shortDate(plan.trialEndsAt)}` : "Escolha um plano",
      href: "/configuracoes/assinatura",
    });
  if (summary) {
    if (summary.units === 0) list.push({ text: "Nenhuma unidade ativa", href: "/configuracoes/unidades" });
    if (summary.professionals === 0) list.push({ text: "Nenhum profissional cadastrado", href: "/configuracoes/profissionais" });
    if (summary.chairs === 0) list.push({ text: "Nenhuma cadeira cadastrada", href: "/configuracoes/cadeiras" });
    if (summary.unpriced > 0) list.push({ text: `${n(summary.unpriced, "procedimento", "procedimentos")} sem preço`, href: "/configuracoes/procedimentos" });
    if (summary.paymentMethods === 0) list.push({ text: "Nenhuma forma de pagamento ativa", href: "/configuracoes/formas-de-pagamento" });
  }
  return list;
}
