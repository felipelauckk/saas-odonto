/**
 * Situação financeira do paciente, numa função só (cartão da consulta e ficha).
 * Vencido = parcela "overdue" ou aberta com vencimento antes de hoje (mesma
 * regra da lista de recebimentos e da ficha).
 */

export type StatusReceivable = {
  id: string;
  description: string;
  amount_cents: number;
  due_date: string;
  status: "open" | "paid" | "overdue" | "canceled";
  plan_id: string | null;
};

export type PatientFinancialStatus =
  | { kind: "overdue"; overdueCents: number; overdueCount: number; oldest: StatusReceivable; note: string }
  | { kind: "ok"; note: string };

export function isOverdue(r: Pick<StatusReceivable, "status" | "due_date">, today: string): boolean {
  return r.status === "overdue" || (r.status === "open" && r.due_date < today);
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** `planId`: plano aprovado mais recente (para "Plano aprovado · 3 de 6 parcelas pagas"). */
export function financialStatus(receivables: StatusReceivable[], today: string, planId: string | null): PatientFinancialStatus {
  const live = receivables.filter((r) => r.status !== "canceled");
  const overdue = live.filter((r) => isOverdue(r, today)).sort((a, b) => a.due_date.localeCompare(b.due_date));
  if (overdue.length) {
    const cents = overdue.reduce((s, r) => s + r.amount_cents, 0);
    const oldest = overdue[0]!;
    const note = overdue.length === 1 ? `${oldest.description} · ${brl.format(cents / 100)}` : `${overdue.length} parcelas vencidas · ${brl.format(cents / 100)}`;
    return { kind: "overdue", overdueCents: cents, overdueCount: overdue.length, oldest, note };
  }
  if (!live.length) return { kind: "ok", note: "Nenhuma cobrança" };
  const ofPlan = planId ? live.filter((r) => r.plan_id === planId) : [];
  if (ofPlan.length) {
    const paid = ofPlan.filter((r) => r.status === "paid").length;
    return { kind: "ok", note: `Plano aprovado · ${paid} de ${ofPlan.length} parcela${ofPlan.length === 1 ? "" : "s"} paga${paid === 1 ? "" : "s"}` };
  }
  const paid = live.filter((r) => r.status === "paid").length;
  return { kind: "ok", note: `${paid} de ${live.length} cobrança${live.length === 1 ? "" : "s"} paga${paid === 1 ? "" : "s"}` };
}
