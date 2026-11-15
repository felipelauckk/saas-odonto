import "server-only";

import { runReport } from "@/features/reports/run";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { addDays, utcToZoned, zonedToUtc } from "@/lib/timezone";

import { emptyMonth, monthsBack, nextMonth, type GoalMetric, type MonthStats } from "./logic";

const monthOf = (iso: string) => utcToZoned(iso).date.slice(0, 7);

/**
 * Indicadores mensais (últimos N meses) da clínica ou de uma unidade, com
 * quebra por profissional e por unidade para o mês escolhido.
 */
export async function getAnalytics({ month, months = 12, unitId }: { month: string; months?: number; unitId: string | null }) {
  const supabase = await createClient();
  const list = monthsBack(month, months);
  const start = zonedToUtc(`${list[0]}-01`, "00:00").toISOString();
  const end = zonedToUtc(`${nextMonth(month)}-01`, "00:00").toISOString();

  const [paid, done, plans, patients, units, pros, goals] = await Promise.all([
    fetchAll((a, b) => {
      let q = supabase.from("receivables").select("paid_amount_cents, paid_at, unit_id, professional_id").eq("status", "paid").gte("paid_at", start).lt("paid_at", end).order("id");
      if (unitId) q = q.eq("unit_id", unitId);
      return q.range(a, b);
    }),
    fetchAll((a, b) => {
      let q = supabase.from("treatment_items").select("price_cents, done_at, treatment_plans!inner(unit_id, professional_id)").eq("status", "done").gte("done_at", start).lt("done_at", end).order("id");
      if (unitId) q = q.eq("treatment_plans.unit_id", unitId);
      return q.range(a, b);
    }),
    fetchAll((a, b) => {
      let q = supabase.from("treatment_plans").select("status, total_cents, created_at, approved_at, unit_id, professional_id").neq("status", "draft").gte("created_at", zonedToUtc(`${list[0]}-01`, "00:00").toISOString()).lt("created_at", end).order("id");
      if (unitId) q = q.eq("unit_id", unitId);
      return q.range(a, b);
    }),
    fetchAll((a, b) => supabase.from("patients").select("created_at").gte("created_at", start).lt("created_at", end).order("id").range(a, b)),
    supabase.from("units").select("id, name").eq("active", true).order("name"),
    supabase.from("professionals").select("id, name").eq("active", true).order("name"),
    supabase.from("goals").select("metric, unit_id, professional_id, target").eq("month", `${month}-01`),
  ]);

  const byMonth = new Map<string, MonthStats>(list.map((m) => [m, emptyMonth(m)]));
  const byPro = new Map<string, MonthStats>();
  const byUnit = new Map<string, MonthStats>();
  const bucket = (map: Map<string, MonthStats>, key: string | null) => {
    if (!key) return null;
    let s = map.get(key);
    if (!s) {
      s = emptyMonth(month);
      map.set(key, s);
    }
    return s;
  };

  for (const r of paid) {
    const m = monthOf(r.paid_at!);
    const v = r.paid_amount_cents ?? 0;
    const s = byMonth.get(m);
    if (s) s.revenue += v;
    if (m === month) {
      const p = bucket(byPro, r.professional_id);
      if (p) p.revenue += v;
      const u = bucket(byUnit, r.unit_id);
      if (u) u.revenue += v;
    }
  }
  for (const i of done) {
    const m = monthOf(i.done_at!);
    const s = byMonth.get(m);
    if (s) s.production += i.price_cents;
    if (m === month) {
      const p = bucket(byPro, i.treatment_plans.professional_id);
      if (p) p.production += i.price_cents;
      const u = bucket(byUnit, i.treatment_plans.unit_id);
      if (u) u.production += i.price_cents;
    }
  }
  for (const p of plans) {
    const created = monthOf(p.created_at);
    const approved = p.approved_at && ["approved", "partially_approved", "completed"].includes(p.status) ? monthOf(p.approved_at) : null;
    const s = byMonth.get(created);
    if (s) {
      s.issued++;
      if (approved) s.issuedApproved++;
    }
    if (approved) {
      const a = byMonth.get(approved);
      if (a) {
        a.approvedQuotes++;
        a.approvedValue += p.total_cents;
      }
    }
    if (created === month) {
      for (const [map, key] of [[byPro, p.professional_id], [byUnit, p.unit_id]] as const) {
        const b = bucket(map, key);
        if (!b) continue;
        b.issued++;
        if (approved) b.issuedApproved++;
      }
    }
    if (approved === month) {
      for (const [map, key] of [[byPro, p.professional_id], [byUnit, p.unit_id]] as const) {
        const b = bucket(map, key);
        if (!b) continue;
        b.approvedQuotes++;
        b.approvedValue += p.total_cents;
      }
    }
  }
  for (const p of patients) {
    const s = byMonth.get(monthOf(p.created_at));
    if (s) s.newPatients++;
  }

  const occupancy = await runReport("ocupacao", { from: `${month}-01`, to: lastDay(month), unitId, professionalId: null, months: 6, groupBy: "profissional" });

  return {
    months: list.map((m) => byMonth.get(m)!),
    professionals: (pros.data ?? []).map((p) => ({ id: p.id, name: p.name, stats: byPro.get(p.id) ?? emptyMonth(month) })),
    units: (units.data ?? []).map((u) => ({ id: u.id, name: u.name, stats: byUnit.get(u.id) ?? emptyMonth(month) })),
    goals: (goals.data ?? []).map((g) => ({ metric: g.metric as GoalMetric, unitId: g.unit_id, professionalId: g.professional_id, target: Number(g.target) })),
    occupancy: occupancy?.rows.map((r) => ({ name: String(r.group), rate: r.rate === null ? null : Number(r.rate) })) ?? [],
  };
}

function lastDay(month: string) {
  return addDays(`${nextMonth(month)}-01`, -1);
}

/** Funil de captação: leads criados no período → paciente com consulta → orçamento → fechado. */
export async function getFunnel(from: string, to: string) {
  const supabase = await createClient();
  const leads = await fetchAll((a, b) =>
    supabase
      .from("leads")
      .select("patient_id")
      .gte("created_at", zonedToUtc(from, "00:00").toISOString())
      .lt("created_at", zonedToUtc(addDays(to, 1), "00:00").toISOString())
      .order("id")
      .range(a, b),
  );
  const patientIds = [...new Set(leads.map((l) => l.patient_id).filter((id): id is string => Boolean(id)))];
  const withVisit = new Set<string>();
  const withQuote = new Set<string>();
  const won = new Set<string>();
  for (let i = 0; i < patientIds.length; i += 200) {
    const ids = patientIds.slice(i, i + 200);
    const [appts, plans] = await Promise.all([
      supabase.from("appointments").select("patient_id").in("patient_id", ids).not("status", "in", "(canceled)"),
      supabase.from("treatment_plans").select("patient_id, status").in("patient_id", ids).neq("status", "draft"),
    ]);
    for (const a of appts.data ?? []) withVisit.add(a.patient_id);
    for (const p of plans.data ?? []) {
      withQuote.add(p.patient_id);
      if (["approved", "partially_approved", "completed"].includes(p.status)) won.add(p.patient_id);
    }
  }
  return [
    { label: "Leads", value: leads.length },
    { label: "Avaliação marcada", value: withVisit.size },
    { label: "Orçamento apresentado", value: withQuote.size },
    { label: "Fechou tratamento", value: won.size },
  ];
}
