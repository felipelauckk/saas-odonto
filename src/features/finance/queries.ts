import "server-only";

import { createClient } from "@/lib/supabase/server";
import { addDays, zonedToUtc } from "@/lib/timezone";

import { RECEIVABLE_FILTERS, type ReceivableFilter } from "./labels";

const RECEIVABLE_SELECT =
  "id, description, amount_cents, due_date, status, paid_at, paid_amount_cents, fee_cents, installment_number, installment_total, patient_id, plan_id, in_negotiation, patients!inner(full_name, search_name, whatsapp, phone), professionals(name), payment_methods(name)";

export async function listReceivables({
  filter,
  from,
  to,
  q,
}: {
  filter: ReceivableFilter;
  from: string | null;
  to: string | null;
  q: string;
}) {
  const supabase = await createClient();
  let query = supabase
    .from("receivables")
    .select(RECEIVABLE_SELECT)
    .in("status", [...RECEIVABLE_FILTERS[filter].statuses])
    .order("due_date")
    .limit(300);
  if (from) query = query.gte("due_date", from);
  if (to) query = query.lte("due_date", to);
  if (q) {
    const term = q.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[%_]/g, "");
    query = query.ilike("patients.search_name", `%${term}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export type ReceivableRow = Awaited<ReturnType<typeof listReceivables>>[number];

export async function listPatientReceivables(patientId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("receivables").select(RECEIVABLE_SELECT).eq("patient_id", patientId).order("due_date");
  if (error) throw error;
  return data;
}

/** Totais para os cartões do topo. */
export async function getReceivablesSummary() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("receivables").select("status, amount_cents").in("status", ["open", "overdue"]);
  if (error) throw error;
  const sum = (status: string) => data.filter((r) => r.status === status).reduce((s, r) => s + r.amount_cents, 0);
  return { open: sum("open"), overdue: sum("overdue"), overdueCount: data.filter((r) => r.status === "overdue").length };
}

export async function getCashDay({ unitId, date }: { unitId: string; date: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cash_movements")
    .select("id, type, amount_cents, description, occurred_at, receivable_id, payment_methods(name)")
    .eq("unit_id", unitId)
    .gte("occurred_at", zonedToUtc(date, "00:00").toISOString())
    .lt("occurred_at", zonedToUtc(addDays(date, 1), "00:00").toISOString())
    .order("occurred_at");
  if (error) throw error;
  const totalIn = data.filter((m) => m.type === "in").reduce((s, m) => s + m.amount_cents, 0);
  const totalOut = data.filter((m) => m.type === "out").reduce((s, m) => s + m.amount_cents, 0);
  const byMethod = new Map<string, number>();
  for (const m of data) {
    const name = m.payment_methods?.name ?? "Não informado";
    byMethod.set(name, (byMethod.get(name) ?? 0) + (m.type === "in" ? m.amount_cents : -m.amount_cents));
  }
  return { movements: data, totalIn, totalOut, byMethod: [...byMethod.entries()] };
}

export async function getReceipt(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("receivables")
    .select("id, description, paid_at, paid_amount_cents, status, installment_number, installment_total, patients(full_name, cpf), payment_methods(name), units(name)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listActivePaymentMethods() {
  const supabase = await createClient();
  const { data } = await supabase.from("payment_methods").select("id, name, fee_percent").eq("active", true).order("created_at");
  return data ?? [];
}

export async function listExpenseCategories() {
  const supabase = await createClient();
  const { data } = await supabase.from("finance_categories").select("id, name").eq("type", "expense").eq("active", true).order("name");
  return data ?? [];
}

/**
 * Vencimentos até `days` dias à frente (inclui os já vencidos): as primeiras
 * linhas de cada lado e o total. Contas a pagar só aparecem para a gestão (RLS).
 */
export async function getUpcomingDues(today: string, days = 7) {
  const supabase = await createClient();
  const until = addDays(today, days);
  const [rec, pay] = await Promise.all([
    supabase
      .from("receivables")
      .select("id, description, amount_cents, due_date, installment_number, installment_total, patients(full_name)")
      .in("status", ["open", "overdue"])
      .lte("due_date", until)
      .order("due_date")
      .limit(200),
    supabase
      .from("payables")
      .select("id, description, amount_cents, due_date, suppliers(name)")
      .in("status", ["open", "overdue"])
      .lte("due_date", until)
      .order("due_date")
      .limit(200),
  ]);
  if (rec.error) throw rec.error;
  if (pay.error) throw pay.error;
  const total = (rows: { amount_cents: number }[]) => rows.reduce((s, r) => s + r.amount_cents, 0);
  return {
    receivables: { total: total(rec.data), count: rec.data.length, rows: rec.data.slice(0, 5) },
    payables: { total: total(pay.data), count: pay.data.length, rows: pay.data.slice(0, 5) },
  };
}
