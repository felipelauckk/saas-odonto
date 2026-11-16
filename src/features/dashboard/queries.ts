import "server-only";

import { z } from "zod";

import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { addDays, utcToZoned, zonedToUtc } from "@/lib/timezone";
import { todayIso } from "@/lib/dates";
import { crcQueues, type CrcQueue } from "@/features/crc/labels";
import { daysSince } from "@/features/crc/logic";
import { getCrcBoard } from "@/features/crc/queries";

import { STALLED_QUOTE_DAYS } from "./logic";

const metricsSchema = z.object({
  appointments_today: z.number(),
  appointments_today_done: z.number(),
  revenue_month_cents: z.number(),
  receivable_open_cents: z.number(),
  receivable_overdue_cents: z.number(),
  open_plans: z.number(),
  open_plans_cents: z.number(),
  no_show_30d: z.number(),
  past_appointments_30d: z.number(),
});

export type DashboardMetrics = z.infer<typeof metricsSchema>;

/** Indicadores (respeitam a RLS de quem pede). unitId nulo = consolidado. */
export async function getDashboardMetrics(unitId: string | null): Promise<DashboardMetrics> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_metrics", { _unit_id: unitId as string });
  if (error) throw error;
  return metricsSchema.parse(data);
}

/** Consultas de hoje (para a lista do painel). */
export async function getTodayAppointments(unitId: string | null) {
  const supabase = await createClient();
  const today = todayIso();
  let query = supabase
    .from("appointments")
    .select("id, starts_at, status, type, patient_id, patients(full_name), professionals(name, color)")
    .neq("status", "canceled")
    .gte("starts_at", zonedToUtc(today, "00:00").toISOString())
    .lt("starts_at", zonedToUtc(addDays(today, 1), "00:00").toISOString())
    .order("starts_at")
    .limit(30);
  if (unitId) query = query.eq("unit_id", unitId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// --- Painel (R3): séries e blocos extras. Só leituras, sempre com a RLS de quem pede. ---

const PAID_PLAN_STATUSES = ["approved", "partially_approved", "completed"];

function monthStart(date: string) {
  return `${date.slice(0, 7)}-01`;
}

function previousMonthStart(date: string) {
  const [y, m] = date.split("-").map(Number) as [number, number];
  const prev = new Date(Date.UTC(y, m - 2, 1));
  return prev.toISOString().slice(0, 10);
}

/**
 * Recebido por dia no mês atual (índice 0 = dia 1) e o total do mesmo período
 * do mês anterior (do dia 1 até o mesmo dia).
 */
export async function getRevenueSeries(unitId: string | null, today: string) {
  const supabase = await createClient();
  const prevStart = previousMonthStart(today);
  const rows = await fetchAll((a, b) => {
    let q = supabase
      .from("receivables")
      .select("paid_amount_cents, paid_at")
      .eq("status", "paid")
      .gte("paid_at", zonedToUtc(prevStart, "00:00").toISOString())
      .lt("paid_at", zonedToUtc(addDays(today, 1), "00:00").toISOString())
      .order("id")
      .range(a, b);
    if (unitId) q = q.eq("unit_id", unitId);
    return q;
  });
  const day = Number(today.slice(8, 10));
  const currentMonth = today.slice(0, 7);
  const daily = Array<number>(day).fill(0);
  let previous = 0;
  for (const r of rows) {
    if (!r.paid_at) continue;
    const date = utcToZoned(r.paid_at).date;
    const d = Number(date.slice(8, 10));
    const value = r.paid_amount_cents ?? 0;
    if (date.startsWith(currentMonth)) daily[d - 1] = (daily[d - 1] ?? 0) + value;
    else if (d <= day) previous += value;
  }
  return { daily, previous };
}

/** Consultas (sem as canceladas) por dia nos últimos 7 dias e as de amanhã ainda sem confirmação. */
export async function getAppointmentTrend(unitId: string | null, today: string) {
  const supabase = await createClient();
  const from = addDays(today, -6);
  const tomorrow = addDays(today, 1);
  let q = supabase
    .from("appointments")
    .select("starts_at, status")
    .neq("status", "canceled")
    .gte("starts_at", zonedToUtc(from, "00:00").toISOString())
    .lt("starts_at", zonedToUtc(addDays(tomorrow, 1), "00:00").toISOString())
    .order("starts_at")
    .limit(5000);
  if (unitId) q = q.eq("unit_id", unitId);
  const { data, error } = await q;
  if (error) throw error;
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const perDay = new Map(days.map((d) => [d, 0]));
  let unconfirmedTomorrow = 0;
  let noShowToday = 0;
  for (const a of data) {
    const date = utcToZoned(a.starts_at).date;
    if (date === tomorrow) {
      if (a.status === "scheduled") unconfirmedTomorrow++;
      continue;
    }
    if (perDay.has(date)) perDay.set(date, perDay.get(date)! + 1);
    if (date === today && a.status === "no_show") noShowToday++;
  }
  return { perDay: days.map((d) => perDay.get(d)!), unconfirmedTomorrow, noShowToday };
}

/** Conversão de orçamentos (apresentados no mês que foram aprovados), mês atual e anterior. */
export async function getQuoteConversion(unitId: string | null, today: string) {
  const supabase = await createClient();
  const start = monthStart(today);
  const prevStart = previousMonthStart(today);
  const rows = await fetchAll((a, b) => {
    let q = supabase
      .from("treatment_plans")
      .select("status, created_at, approved_at")
      .neq("status", "draft")
      .gte("created_at", zonedToUtc(prevStart, "00:00").toISOString())
      .order("id")
      .range(a, b);
    if (unitId) q = q.eq("unit_id", unitId);
    return q;
  });
  const empty = () => ({ issued: 0, approved: 0 });
  const current = empty();
  const previous = empty();
  for (const p of rows) {
    const bucket = utcToZoned(p.created_at).date >= start ? current : previous;
    bucket.issued++;
    if (p.approved_at && PAID_PLAN_STATUSES.includes(p.status)) bucket.approved++;
  }
  const rate = (s: { issued: number; approved: number }) => (s.issued ? s.approved / s.issued : null);
  return { ...current, rate: rate(current), previousRate: rate(previous) };
}

/** Meta de faturamento do mês (clínica toda ou da unidade). Só a gestão lê metas. */
export async function getRevenueGoal(unitId: string | null, today: string): Promise<number | null> {
  const supabase = await createClient();
  let q = supabase
    .from("goals")
    .select("target")
    .eq("month", monthStart(today))
    .eq("metric", "revenue")
    .is("professional_id", null);
  q = unitId ? q.eq("unit_id", unitId) : q.is("unit_id", null);
  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  return data ? Number(data.target) : null;
}

/** Filas da CRC resumidas para o "Para recuperar" (sem aniversariantes). Só recepção e gestão. */
export async function getRecoveryQueues(today: string) {
  const board = await getCrcBoard(today);
  const summary = new Map<CrcQueue, { queue: CrcQueue; count: number; amountCents: number; oldestDays: number | null }>();
  let stalledQuotes = 0;
  for (const item of board.now) {
    if (item.queue === "birthdays") continue;
    const s = summary.get(item.queue) ?? { queue: item.queue, count: 0, amountCents: 0, oldestDays: null };
    const days = daysSince(item.refDate, today);
    s.count++;
    s.amountCents += item.amountCents ?? 0;
    if (days !== null && (s.oldestDays === null || days > s.oldestDays)) s.oldestDays = days;
    summary.set(item.queue, s);
    if (item.queue === "open_quotes" && days !== null && days > STALLED_QUOTE_DAYS) stalledQuotes++;
  }
  const queues = crcQueues.flatMap((q) => summary.get(q) ?? []);
  return { queues, stalledQuotes };
}
