import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { addDays, zonedToUtc } from "@/lib/timezone";
import { todayIso } from "@/lib/dates";

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
