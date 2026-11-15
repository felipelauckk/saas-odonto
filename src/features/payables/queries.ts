import "server-only";

import { createClient } from "@/lib/supabase/server";
import { addDays, utcToZoned, zonedToUtc } from "@/lib/timezone";

import { suggestMatches, type MatchCandidate } from "./ofx";
import { buildDre, cashFlow, type Granularity } from "./reports";

export const PAYABLE_FILTERS = {
  abertas: { label: "A pagar", statuses: ["open", "overdue"] },
  vencidas: { label: "Vencidas", statuses: ["overdue"] },
  pagas: { label: "Pagas", statuses: ["paid"] },
  canceladas: { label: "Canceladas", statuses: ["canceled"] },
} as const;
export type PayableFilter = keyof typeof PAYABLE_FILTERS;

export async function listPayables(filter: PayableFilter) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payables")
    .select("id, description, amount_cents, due_date, status, paid_at, paid_amount_cents, installment_number, installment_total, recurring, group_id, attachment_path, suppliers(name), finance_categories(name), cost_centers(name)")
    .in("status", [...PAYABLE_FILTERS[filter].statuses])
    .order("due_date", { ascending: filter !== "pagas" })
    .limit(300);
  if (error) throw error;
  return data;
}

export async function listFinanceSetup() {
  const supabase = await createClient();
  const [{ data: categories }, { data: suppliers }, { data: costCenters }] = await Promise.all([
    supabase.from("finance_categories").select("id, type, name, active").order("type").order("name"),
    supabase.from("suppliers").select("id, name, document, phone, email, notes, active").order("name"),
    supabase.from("cost_centers").select("id, name, active").order("name"),
  ]);
  return { categories: categories ?? [], suppliers: suppliers ?? [], costCenters: costCenters ?? [] };
}

/** Fluxo de caixa: realizado (caixa) + previsto (abertos) no intervalo. */
export async function getCashFlow({ from, to, granularity, unitId }: { from: string; to: string; granularity: Granularity; unitId: string | null }) {
  const supabase = await createClient();
  const start = zonedToUtc(from, "00:00").toISOString();
  const end = zonedToUtc(addDays(to, 1), "00:00").toISOString();
  let movements = supabase.from("cash_movements").select("type, amount_cents, occurred_at").gte("occurred_at", start).lt("occurred_at", end);
  let receivables = supabase.from("receivables").select("amount_cents, due_date").in("status", ["open", "overdue"]).gte("due_date", from).lte("due_date", to);
  let payables = supabase.from("payables").select("amount_cents, due_date").in("status", ["open", "overdue"]).gte("due_date", from).lte("due_date", to);
  if (unitId) {
    movements = movements.eq("unit_id", unitId);
    receivables = receivables.eq("unit_id", unitId);
    payables = payables.eq("unit_id", unitId);
  }
  const [m, r, p] = await Promise.all([movements, receivables, payables]);
  return cashFlow(
    {
      movements: (m.data ?? []).map((x) => ({ date: utcToZoned(x.occurred_at).date, type: x.type, amountCents: x.amount_cents })),
      receivables: (r.data ?? []).map((x) => ({ dueDate: x.due_date, amountCents: x.amount_cents })),
      payables: (p.data ?? []).map((x) => ({ dueDate: x.due_date, amountCents: x.amount_cents })),
    },
    granularity,
  );
}

/** DRE do mês (AAAA-MM). Despesas = contas pagas + saídas avulsas do caixa, por categoria. */
export async function getDre({ month, unitId }: { month: string; unitId: string | null }) {
  const supabase = await createClient();
  const first = `${month}-01`;
  const [y, mo] = month.split("-").map(Number) as [number, number];
  const next = new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 10);
  const start = zonedToUtc(first, "00:00").toISOString();
  const end = zonedToUtc(next, "00:00").toISOString();
  let revenue = supabase.from("receivables").select("paid_amount_cents, fee_cents").eq("status", "paid").gte("paid_at", start).lt("paid_at", end);
  let paidBills = supabase.from("payables").select("paid_amount_cents, finance_categories(name)").eq("status", "paid").gte("paid_at", start).lt("paid_at", end);
  let cashOut = supabase.from("cash_movements").select("amount_cents, finance_categories(name)").eq("type", "out").is("payable_id", null).is("receivable_id", null).gte("occurred_at", start).lt("occurred_at", end);
  if (unitId) {
    revenue = revenue.eq("unit_id", unitId);
    paidBills = paidBills.eq("unit_id", unitId);
    cashOut = cashOut.eq("unit_id", unitId);
  }
  const [r, b, c] = await Promise.all([revenue, paidBills, cashOut]);
  return buildDre({
    revenue: (r.data ?? []).map((x) => ({ amountCents: x.paid_amount_cents ?? 0, feeCents: x.fee_cents })),
    expenses: [
      ...(b.data ?? []).map((x) => ({ category: x.finance_categories?.name ?? "Sem categoria", amountCents: x.paid_amount_cents ?? 0 })),
      ...(c.data ?? []).map((x) => ({ category: x.finance_categories?.name ?? "Sem categoria", amountCents: x.amount_cents })),
    ],
  });
}

/** Extrato importado com sugestão de par para cada linha ainda não conciliada. */
export async function getReconciliation() {
  const supabase = await createClient();
  const { data: bank } = await supabase.from("bank_transactions").select("id, posted_on, amount_cents, description, status, account_label").order("posted_on", { ascending: false }).limit(300);
  const pending = (bank ?? []).filter((b) => b.status === "unmatched");
  if (!pending.length) return { transactions: bank ?? [], suggestions: new Map<string, MatchCandidate>() };
  const dates = pending.map((p) => p.posted_on).sort();
  const from = addDays(dates[0]!, -5);
  const to = addDays(dates[dates.length - 1]!, 5);
  const [{ data: matched }, { data: rec }, { data: pay }] = await Promise.all([
    supabase.from("bank_transactions").select("receivable_id, payable_id").eq("status", "matched"),
    supabase.from("receivables").select("id, paid_amount_cents, paid_at, description, patients(full_name)").eq("status", "paid").gte("paid_at", zonedToUtc(from, "00:00").toISOString()).lte("paid_at", zonedToUtc(to, "23:59").toISOString()),
    supabase.from("payables").select("id, paid_amount_cents, paid_at, description").eq("status", "paid").gte("paid_at", zonedToUtc(from, "00:00").toISOString()).lte("paid_at", zonedToUtc(to, "23:59").toISOString()),
  ]);
  const taken = new Set((matched ?? []).flatMap((m) => [m.receivable_id, m.payable_id]).filter(Boolean));
  const candidates: MatchCandidate[] = [
    ...(rec ?? []).filter((r) => !taken.has(r.id)).map((r) => ({ id: r.id, kind: "receivable" as const, amountCents: r.paid_amount_cents ?? 0, date: utcToZoned(r.paid_at!).date, label: `${r.patients?.full_name ?? ""} · ${r.description}` })),
    ...(pay ?? []).filter((p) => !taken.has(p.id)).map((p) => ({ id: p.id, kind: "payable" as const, amountCents: p.paid_amount_cents ?? 0, date: utcToZoned(p.paid_at!).date, label: p.description })),
  ];
  const suggestions = suggestMatches(pending.map((p) => ({ id: p.id, amountCents: p.amount_cents, postedOn: p.posted_on })), candidates);
  return { transactions: bank ?? [], suggestions };
}
