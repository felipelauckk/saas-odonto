import "server-only";

import { getStatement } from "@/features/commissions/queries";
import { cancelReasonLabels, type CancelReason } from "@/features/agenda/advanced";
import { queueLabels, crcQueues } from "@/features/crc/labels";
import { getCrmReport } from "@/features/crm/queries";
import { buildDre } from "@/features/payables/reports";
import { todayIso } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { addDays, timeToMinutes, utcToZoned, weekdayOf, zonedToUtc } from "@/lib/timezone";

import { AGE_BANDS, ageBand, allocate, birthdayInRange, debtBucket, overlapMinutes, unionMinutes, type Interval } from "./calc";
import type { ReportFilters, ReportResult, Row } from "./types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const rangeOf = (f: ReportFilters) => ({ start: zonedToUtc(f.from, "00:00").toISOString(), end: zonedToUtc(addDays(f.to, 1), "00:00").toISOString() });
const ratio = (a: number, b: number) => (b ? a / b : null);
const sum = (rows: Row[], key: string) => rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);


/** Divide uma lista de ids em pedaços para consultas com `in`. */
function chunks<T>(list: T[], size = 200): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function groupRows(map: Map<string, Row>, key: string, init: () => Row): Row {
  let row = map.get(key);
  if (!row) {
    row = init();
    map.set(key, row);
  }
  return row;
}

// 1. Faturamento -----------------------------------------------------------------------------

async function faturamento(supabase: Supabase, f: ReportFilters): Promise<ReportResult> {
  const { start, end } = rangeOf(f);
  const receivables = await fetchAll((a, b) => {
    let q = supabase
      .from("receivables")
      .select("id, paid_amount_cents, fee_cents, paid_at, plan_id, professional_id, professionals(name), payment_methods(name)")
      .eq("status", "paid")
      .gte("paid_at", start)
      .lt("paid_at", end)
      .order("id");
    if (f.unitId) q = q.eq("unit_id", f.unitId);
    if (f.professionalId) q = q.eq("professional_id", f.professionalId);
    return q.range(a, b);
  });

  const groups = new Map<string, Row>();
  const add = (key: string, gross: number, fee: number, count: number) => {
    const row = groupRows(groups, key, () => ({ group: key, count: 0, gross: 0, fees: 0, net: 0 }));
    row.count = Number(row.count) + count;
    row.gross = Number(row.gross) + gross;
    row.fees = Number(row.fees) + fee;
    row.net = Number(row.net) + gross - fee;
  };

  if (f.groupBy === "procedimento" || f.groupBy === "categoria") {
    const planIds = [...new Set(receivables.map((r) => r.plan_id).filter((id): id is string => Boolean(id)))];
    const items: { plan_id: string; price_cents: number; status: string; description: string; procedures: { name: string; category: string | null } | null }[] = [];
    for (const ids of chunks(planIds)) {
      const { data } = await supabase.from("treatment_items").select("plan_id, price_cents, status, description, procedures(name, category)").in("plan_id", ids);
      items.push(...(data ?? []));
    }
    const byPlan = new Map<string, typeof items>();
    for (const i of items) if (i.status === "approved" || i.status === "done") byPlan.set(i.plan_id, [...(byPlan.get(i.plan_id) ?? []), i]);
    for (const r of receivables) {
      const paid = r.paid_amount_cents ?? 0;
      const planItems = r.plan_id ? (byPlan.get(r.plan_id) ?? []) : [];
      if (!planItems.length) {
        add("Sem orçamento (avulso)", paid, r.fee_cents, 1);
        continue;
      }
      const label = (i: (typeof planItems)[number]) =>
        f.groupBy === "procedimento" ? (i.procedures?.name ?? i.description) : (i.procedures?.category ?? "Sem categoria");
      const weights = planItems.map((i) => ({ key: label(i), weight: i.price_cents }));
      const grossShare = allocate(paid, weights);
      const feeShare = allocate(r.fee_cents, weights);
      for (const [key, gross] of grossShare) add(key, gross, feeShare.get(key) ?? 0, 0);
    }
  } else {
    for (const r of receivables) {
      const key =
        f.groupBy === "profissional"
          ? (r.professionals?.name ?? "Sem profissional")
          : f.groupBy === "forma"
            ? (r.payment_methods?.name ?? "Não informada")
            : utcToZoned(r.paid_at!).date.slice(0, 7);
      add(key, r.paid_amount_cents ?? 0, r.fee_cents, 1);
    }
  }

  const rows = [...groups.values()].sort((a, b) => (f.groupBy === "mes" ? String(a.group).localeCompare(String(b.group)) : Number(b.gross) - Number(a.gross)));
  const byItem = f.groupBy === "procedimento" || f.groupBy === "categoria";
  const groupLabel = { mes: "Mês", profissional: "Profissional", procedimento: "Procedimento", categoria: "Categoria", forma: "Forma de pagamento" }[f.groupBy] ?? "Grupo";
  return {
    columns: [
      { key: "group", label: groupLabel, type: "text" },
      ...(byItem ? [] : [{ key: "count", label: "Recebimentos", type: "int" as const }]),
      { key: "gross", label: "Recebido", type: "money" },
      { key: "fees", label: "Taxas", type: "money" },
      { key: "net", label: "Líquido", type: "money" },
    ],
    rows,
    total: { group: "Total", count: sum(rows, "count"), gross: sum(rows, "gross"), fees: sum(rows, "fees"), net: sum(rows, "net") },
    summary: [
      { label: "Recebido", value: sum(rows, "gross"), type: "money" },
      { label: "Taxas", value: sum(rows, "fees"), type: "money" },
      { label: "Líquido", value: sum(rows, "net"), type: "money" },
      { label: "Recebimentos", value: receivables.length, type: "int" },
    ],
    note: byItem ? "Cada pagamento é rateado entre os itens aprovados do orçamento pelo valor de cada item." : undefined,
  };
}

// 2. Produção ----------------------------------------------------------------------------------

async function producao(supabase: Supabase, f: ReportFilters): Promise<ReportResult> {
  const { start, end } = rangeOf(f);
  const items = await fetchAll((a, b) => {
    let q = supabase
      .from("treatment_items")
      .select("id, price_cents, description, procedures(name), treatment_plans!inner(professional_id, unit_id, professionals(name))")
      .eq("status", "done")
      .gte("done_at", start)
      .lt("done_at", end)
      .order("id");
    if (f.unitId) q = q.eq("treatment_plans.unit_id", f.unitId);
    if (f.professionalId) q = q.eq("treatment_plans.professional_id", f.professionalId);
    return q.range(a, b);
  });
  const groups = new Map<string, Row>();
  for (const i of items) {
    const key = f.groupBy === "procedimento" ? (i.procedures?.name ?? i.description) : (i.treatment_plans.professionals?.name ?? "Sem profissional");
    const row = groupRows(groups, key, () => ({ group: key, count: 0, value: 0 }));
    row.count = Number(row.count) + 1;
    row.value = Number(row.value) + i.price_cents;
  }
  const rows = [...groups.values()].sort((a, b) => Number(b.value) - Number(a.value));
  return {
    columns: [
      { key: "group", label: f.groupBy === "procedimento" ? "Procedimento" : "Profissional", type: "text" },
      { key: "count", label: "Executados", type: "int" },
      { key: "value", label: "Valor (tabela do orçamento)", type: "money" },
    ],
    rows,
    total: { group: "Total", count: sum(rows, "count"), value: sum(rows, "value") },
    summary: [
      { label: "Procedimentos executados", value: sum(rows, "count"), type: "int" },
      { label: "Valor produzido", value: sum(rows, "value"), type: "money" },
    ],
  };
}

// 3. Orçamentos --------------------------------------------------------------------------------

async function orcamentos(supabase: Supabase, f: ReportFilters): Promise<ReportResult> {
  const { start, end } = rangeOf(f);
  const plans = await fetchAll((a, b) => {
    let q = supabase
      .from("treatment_plans")
      .select("id, status, total_cents, professional_id, professionals(name)")
      .neq("status", "draft")
      .gte("created_at", start)
      .lt("created_at", end)
      .order("id");
    if (f.unitId) q = q.eq("unit_id", f.unitId);
    if (f.professionalId) q = q.eq("professional_id", f.professionalId);
    return q.range(a, b);
  });
  const groups = new Map<string, Row>();
  for (const p of plans) {
    const key = p.professionals?.name ?? "Sem profissional";
    const row = groupRows(groups, key, () => ({ group: key, issued: 0, approved: 0, rejected: 0, open: 0, approvedValue: 0 }));
    row.issued = Number(row.issued) + 1;
    if (["approved", "partially_approved", "completed"].includes(p.status)) {
      row.approved = Number(row.approved) + 1;
      row.approvedValue = Number(row.approvedValue) + p.total_cents;
    } else if (p.status === "rejected") row.rejected = Number(row.rejected) + 1;
    else row.open = Number(row.open) + 1;
  }
  const rows = [...groups.values()].map((r): Row => ({
    ...r,
    conversion: ratio(Number(r.approved), Number(r.issued)),
    ticket: Number(r.approved) ? Math.round(Number(r.approvedValue) / Number(r.approved)) : null,
  }));
  const approved = sum(rows, "approved");
  const approvedValue = sum(rows, "approvedValue");
  return {
    columns: [
      { key: "group", label: "Profissional", type: "text" },
      { key: "issued", label: "Emitidos", type: "int" },
      { key: "approved", label: "Aprovados", type: "int" },
      { key: "rejected", label: "Recusados", type: "int" },
      { key: "open", label: "Em aberto", type: "int" },
      { key: "conversion", label: "Conversão", type: "percent" },
      { key: "approvedValue", label: "Valor aprovado", type: "money" },
      { key: "ticket", label: "Ticket médio", type: "money" },
    ],
    rows: rows.sort((a, b) => Number(b.issued) - Number(a.issued)),
    total: { group: "Total", issued: sum(rows, "issued"), approved, rejected: sum(rows, "rejected"), open: sum(rows, "open"), conversion: ratio(approved, sum(rows, "issued")), approvedValue, ticket: approved ? Math.round(approvedValue / approved) : null },
    summary: [
      { label: "Emitidos", value: sum(rows, "issued"), type: "int" },
      { label: "Conversão", value: ratio(approved, sum(rows, "issued")) ?? 0, type: "percent" },
      { label: "Ticket médio", value: approved ? Math.round(approvedValue / approved) : 0, type: "money" },
    ],
    note: "Orçamentos criados no período (rascunhos não contam). Conversão = aprovados (total ou parcial) ÷ emitidos.",
  };
}

// 4. Primeira consulta ----------------------------------------------------------------------------

async function primeiraConsulta(supabase: Supabase, f: ReportFilters): Promise<ReportResult> {
  const { start, end } = rangeOf(f);
  const appts = await fetchAll((a, b) => {
    let q = supabase
      .from("appointments")
      .select("id, patient_id, starts_at, status, patients(patient_sources(name))")
      .eq("is_first_visit", true)
      .neq("status", "canceled")
      .gte("starts_at", start)
      .lt("starts_at", end)
      .order("id");
    if (f.unitId) q = q.eq("unit_id", f.unitId);
    if (f.professionalId) q = q.eq("professional_id", f.professionalId);
    return q.range(a, b);
  });
  const patientIds = [...new Set(appts.map((a) => a.patient_id))];
  const approvedAt = new Map<string, string>();
  for (const ids of chunks(patientIds)) {
    const { data } = await supabase.from("treatment_plans").select("patient_id, approved_at").in("patient_id", ids).not("approved_at", "is", null);
    for (const p of data ?? []) {
      const cur = approvedAt.get(p.patient_id);
      if (!cur || p.approved_at! < cur) approvedAt.set(p.patient_id, p.approved_at!);
    }
  }
  const groups = new Map<string, Row>();
  for (const a of appts) {
    const key = a.patients?.patient_sources?.name ?? "Não informada";
    const row = groupRows(groups, key, () => ({ group: key, total: 0, attended: 0, noShow: 0, treatment: 0 }));
    row.total = Number(row.total) + 1;
    if (["arrived", "in_progress", "done"].includes(a.status)) row.attended = Number(row.attended) + 1;
    if (a.status === "no_show") row.noShow = Number(row.noShow) + 1;
    const approved = approvedAt.get(a.patient_id);
    if (approved && approved >= a.starts_at.slice(0, 10)) row.treatment = Number(row.treatment) + 1;
  }
  const rows = [...groups.values()].map((r): Row => ({ ...r, conversion: ratio(Number(r.treatment), Number(r.attended)) })).sort((a, b) => Number(b.total) - Number(a.total));
  const attended = sum(rows, "attended");
  const treatment = sum(rows, "treatment");
  return {
    columns: [
      { key: "group", label: "Origem do paciente", type: "text" },
      { key: "total", label: "Primeiras consultas", type: "int" },
      { key: "attended", label: "Compareceram", type: "int" },
      { key: "noShow", label: "Faltaram", type: "int" },
      { key: "treatment", label: "Iniciaram tratamento", type: "int" },
      { key: "conversion", label: "Conversão", type: "percent" },
    ],
    rows,
    total: { group: "Total", total: sum(rows, "total"), attended, noShow: sum(rows, "noShow"), treatment, conversion: ratio(treatment, attended) },
    summary: [
      { label: "Primeiras consultas", value: sum(rows, "total"), type: "int" },
      { label: "Compareceram", value: attended, type: "int" },
      { label: "Conversão em tratamento", value: ratio(treatment, attended) ?? 0, type: "percent" },
    ],
    note: "Iniciou tratamento = orçamento aprovado a partir da data da primeira consulta. Conversão = iniciaram ÷ compareceram.",
  };
}

// 5. Pacientes por local e idade -------------------------------------------------------------------

async function pacientes(supabase: Supabase, f: ReportFilters): Promise<ReportResult> {
  const patients = await fetchAll((a, b) => supabase.from("patients").select("id, address, birth_date").is("archived_at", null).order("id").range(a, b));
  const today = todayIso();
  const groups = new Map<string, Row>();
  for (const p of patients) {
    const addr = (p.address ?? {}) as { district?: string | null; city?: string | null; state?: string | null };
    const city = addr.city ? `${addr.city}${addr.state ? `/${addr.state}` : ""}` : null;
    const key =
      f.groupBy === "idade"
        ? ageBand(p.birth_date, today)
        : f.groupBy === "bairro"
          ? addr.district
            ? `${addr.district}${city ? ` (${city})` : ""}`
            : "Sem bairro"
          : (city ?? "Sem cidade");
    const row = groupRows(groups, key, () => ({ group: key, count: 0 }));
    row.count = Number(row.count) + 1;
  }
  const total = patients.length;
  let rows = [...groups.values()].map((r): Row => ({ ...r, share: ratio(Number(r.count), total) }));
  rows = f.groupBy === "idade" ? rows.sort((a, b) => AGE_BANDS.indexOf(String(a.group)) - AGE_BANDS.indexOf(String(b.group))) : rows.sort((a, b) => Number(b.count) - Number(a.count));
  return {
    columns: [
      { key: "group", label: f.groupBy === "idade" ? "Faixa etária" : f.groupBy === "bairro" ? "Bairro" : "Cidade", type: "text" },
      { key: "count", label: "Pacientes", type: "int" },
      { key: "share", label: "% do total", type: "percent" },
    ],
    rows,
    total: { group: "Total", count: total, share: total ? 1 : null },
    summary: [{ label: "Pacientes ativos", value: total, type: "int" }],
  };
}

// 6. Faltas e desmarcações ---------------------------------------------------------------------------

async function faltas(supabase: Supabase, f: ReportFilters): Promise<ReportResult> {
  const { start, end } = rangeOf(f);
  const appts = await fetchAll((a, b) => {
    let q = supabase.from("appointments").select("id, starts_at, status, cancel_reason, professionals(name)").gte("starts_at", start).lt("starts_at", end).order("id");
    if (f.unitId) q = q.eq("unit_id", f.unitId);
    if (f.professionalId) q = q.eq("professional_id", f.professionalId);
    return q.range(a, b);
  });
  const now = new Date().toISOString();
  const groups = new Map<string, Row>();
  for (const a of appts) {
    const key = a.professionals?.name ?? "Profissional";
    const row = groupRows(groups, key, () => ({ group: key, past: 0, noShow: 0, canceled: 0, patient_canceled: 0, clinic_canceled: 0, rescheduled: 0 }));
    if (a.status === "canceled") {
      row.canceled = Number(row.canceled) + 1;
      if (a.cancel_reason) row[a.cancel_reason] = Number(row[a.cancel_reason]) + 1;
    } else if (a.starts_at < now) row.past = Number(row.past) + 1;
    if (a.status === "no_show") row.noShow = Number(row.noShow) + 1;
  }
  const rows = [...groups.values()].map((r): Row => ({ ...r, rate: ratio(Number(r.noShow), Number(r.past)) }));
  return {
    columns: [
      { key: "group", label: "Profissional", type: "text" },
      { key: "past", label: "Consultas passadas", type: "int" },
      { key: "noShow", label: "Faltas", type: "int" },
      { key: "rate", label: "Taxa de faltas", type: "percent" },
      { key: "canceled", label: "Desmarcações", type: "int" },
      ...(Object.keys(cancelReasonLabels) as CancelReason[]).map((k) => ({ key: k, label: cancelReasonLabels[k], type: "int" as const })),
    ],
    rows,
    total: {
      group: "Total",
      past: sum(rows, "past"),
      noShow: sum(rows, "noShow"),
      rate: ratio(sum(rows, "noShow"), sum(rows, "past")),
      canceled: sum(rows, "canceled"),
      patient_canceled: sum(rows, "patient_canceled"),
      clinic_canceled: sum(rows, "clinic_canceled"),
      rescheduled: sum(rows, "rescheduled"),
    },
    summary: [
      { label: "Faltas", value: sum(rows, "noShow"), type: "int" },
      { label: "Taxa de faltas", value: ratio(sum(rows, "noShow"), sum(rows, "past")) ?? 0, type: "percent" },
      { label: "Desmarcações", value: sum(rows, "canceled"), type: "int" },
    ],
  };
}

// 7. Ocupação ------------------------------------------------------------------------------------

async function ocupacao(supabase: Supabase, f: ReportFilters): Promise<ReportResult> {
  const { start, end } = rangeOf(f);
  let schedQ = supabase.from("professional_schedules").select("professional_id, unit_id, weekday, start_time, end_time, professionals(name, active)");
  let blockQ = supabase.from("schedule_blocks").select("professional_id, unit_id, starts_at, ends_at").eq("kind", "block").lt("starts_at", end).gt("ends_at", start);
  let chairQ = supabase.from("chairs").select("id, name, unit_id").eq("active", true);
  if (f.unitId) {
    schedQ = schedQ.eq("unit_id", f.unitId);
    blockQ = blockQ.eq("unit_id", f.unitId);
    chairQ = chairQ.eq("unit_id", f.unitId);
  }
  const [{ data: schedules }, { data: blocks }, { data: chairs }, appts] = await Promise.all([
    schedQ,
    blockQ,
    chairQ,
    fetchAll((a, b) => {
      let q = supabase.from("appointments").select("professional_id, chair_id, unit_id, starts_at, ends_at, status").neq("status", "canceled").lt("starts_at", end).gt("ends_at", start).order("id");
      if (f.unitId) q = q.eq("unit_id", f.unitId);
      return q.range(a, b);
    }),
  ]);

  const days: string[] = [];
  for (let d = f.from; d <= f.to && days.length < 92; d = addDays(d, 1)) days.push(d);
  const local = (iso: string, day: string) => {
    const z = utcToZoned(iso);
    return z.date < day ? 0 : z.date > day ? 24 * 60 : z.minutes;
  };
  const piece = (s: string, e: string, day: string): Interval => ({ start: local(s, day), end: local(e, day) });
  const touches = (s: string, e: string, day: string) => utcToZoned(s).date <= day && utcToZoned(e).date >= day;

  const rows: Row[] = [];
  if (f.groupBy === "cadeira") {
    for (const chair of chairs ?? []) {
      let available = 0;
      let occupied = 0;
      for (const day of days) {
        const windows = (schedules ?? [])
          .filter((s) => s.unit_id === chair.unit_id && s.weekday === weekdayOf(day))
          .map((s) => ({ start: timeToMinutes(s.start_time), end: timeToMinutes(s.end_time) }));
        available += unionMinutes(windows);
        const used = appts.filter((a) => a.chair_id === chair.id && touches(a.starts_at, a.ends_at, day)).map((a) => piece(a.starts_at, a.ends_at, day));
        occupied += windows.length ? sumOverlap(used, windows) : 0;
      }
      rows.push({ group: chair.name, available: available / 60, occupied: occupied / 60, rate: ratio(occupied, available) });
    }
  } else {
    const pros = new Map<string, string>();
    for (const s of schedules ?? []) if (s.professionals?.active !== false) pros.set(s.professional_id, s.professionals?.name ?? "Profissional");
    for (const [proId, name] of pros) {
      let available = 0;
      let occupied = 0;
      for (const day of days) {
        const windows = (schedules ?? [])
          .filter((s) => s.professional_id === proId && s.weekday === weekdayOf(day))
          .map((s) => ({ start: timeToMinutes(s.start_time), end: timeToMinutes(s.end_time) }));
        if (!windows.length) continue;
        const blocked = (blocks ?? [])
          .filter((b) => (b.professional_id === proId || b.professional_id === null) && touches(b.starts_at, b.ends_at, day))
          .map((b) => piece(b.starts_at, b.ends_at, day));
        const free = unionMinutes(windows) - sumOverlap(blocked, windows);
        available += Math.max(0, free);
        const used = appts.filter((a) => a.professional_id === proId && touches(a.starts_at, a.ends_at, day)).map((a) => piece(a.starts_at, a.ends_at, day));
        occupied += sumOverlap(used, windows);
      }
      rows.push({ group: name, available: available / 60, occupied: occupied / 60, rate: ratio(occupied, available) });
    }
  }
  rows.sort((a, b) => String(a.group).localeCompare(String(b.group)));
  const available = sum(rows, "available");
  const occupied = sum(rows, "occupied");
  return {
    columns: [
      { key: "group", label: f.groupBy === "cadeira" ? "Cadeira" : "Profissional", type: "text" },
      { key: "available", label: "Horas disponíveis", type: "decimal" },
      { key: "occupied", label: "Horas ocupadas", type: "decimal" },
      { key: "rate", label: "Ocupação", type: "percent" },
    ],
    rows,
    total: { group: "Total", available, occupied, rate: ratio(occupied, available) },
    summary: [{ label: "Ocupação", value: ratio(occupied, available) ?? 0, type: "percent" }],
    note:
      f.groupBy === "cadeira"
        ? "Disponível = horário de atendimento da unidade (soma dos horários dos profissionais). Ocupado = consultas na cadeira, inclusive faltas."
        : "Disponível = horários de atendimento menos bloqueios. Ocupado = consultas dentro do horário, inclusive faltas (o horário ficou reservado). Até 92 dias.",
  };
}

/** Minutos de "used" (unidos) que caem dentro de "windows" (unidas). */
function sumOverlap(used: Interval[], windows: Interval[]): number {
  if (!used.length) return 0;
  const merged = mergeIntervals(used);
  const win = mergeIntervals(windows);
  let total = 0;
  for (const u of merged) for (const w of win) total += overlapMinutes(u, w);
  return total;
}

function mergeIntervals(list: Interval[]): Interval[] {
  const sorted = [...list].filter((i) => i.end > i.start).sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const i of sorted) {
    const last = out.at(-1);
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else out.push({ ...i });
  }
  return out;
}

// 8. Sem visita --------------------------------------------------------------------------------------

async function semVisita(supabase: Supabase, f: ReportFilters): Promise<ReportResult> {
  const today = todayIso();
  const cutoffDate = new Date(`${today}T12:00:00Z`);
  cutoffDate.setUTCMonth(cutoffDate.getUTCMonth() - f.months);
  const cutoff = cutoffDate.toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();
  const [visits, future] = await Promise.all([
    fetchAll((a, b) => {
      let q = supabase.from("appointments").select("patient_id, starts_at").in("status", ["arrived", "in_progress", "done"]).order("id");
      if (f.unitId) q = q.eq("unit_id", f.unitId);
      return q.range(a, b);
    }),
    fetchAll((a, b) => supabase.from("appointments").select("patient_id").gt("starts_at", nowIso).not("status", "in", "(canceled,no_show)").order("id").range(a, b)),
  ]);
  const last = new Map<string, string>();
  for (const v of visits) if (!last.has(v.patient_id) || v.starts_at > last.get(v.patient_id)!) last.set(v.patient_id, v.starts_at);
  const booked = new Set(future.map((x) => x.patient_id));
  const candidates = [...last.entries()].filter(([id, at]) => !booked.has(id) && utcToZoned(at).date < cutoff);
  const rows: Row[] = [];
  for (const ids of chunks(candidates.map(([id]) => id))) {
    const { data } = await supabase.from("patients").select("id, full_name, phone, whatsapp").in("id", ids).is("archived_at", null);
    for (const p of data ?? []) {
      const date = utcToZoned(last.get(p.id)!).date;
      const months = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / (30.44 * 86_400_000));
      rows.push({ group: p.full_name, phone: p.whatsapp ?? p.phone ?? null, lastVisit: date, months });
    }
  }
  rows.sort((a, b) => String(a.lastVisit).localeCompare(String(b.lastVisit)));
  return {
    columns: [
      { key: "group", label: "Paciente", type: "text" },
      { key: "phone", label: "Telefone", type: "text" },
      { key: "lastVisit", label: "Última consulta", type: "date" },
      { key: "months", label: "Meses sem visita", type: "int" },
    ],
    rows,
    summary: [{ label: `Pacientes sem visita há mais de ${f.months} meses`, value: rows.length, type: "int" }],
    note: "Só pacientes ativos já atendidos e sem consulta futura marcada.",
  };
}

// 9. Aniversariantes ------------------------------------------------------------------------------

async function aniversariantes(supabase: Supabase, f: ReportFilters): Promise<ReportResult> {
  const patients = await fetchAll((a, b) => supabase.from("patients").select("id, full_name, birth_date, phone, whatsapp").is("archived_at", null).not("birth_date", "is", null).order("id").range(a, b));
  const rows: Row[] = [];
  for (const p of patients) {
    const date = birthdayInRange(p.birth_date!, f.from, f.to);
    if (!date) continue;
    rows.push({ date, group: p.full_name, age: Number(date.slice(0, 4)) - Number(p.birth_date!.slice(0, 4)), phone: p.whatsapp ?? p.phone ?? null });
  }
  rows.sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.group).localeCompare(String(b.group)));
  return {
    columns: [
      { key: "date", label: "Aniversário", type: "date" },
      { key: "group", label: "Paciente", type: "text" },
      { key: "age", label: "Completa (anos)", type: "int" },
      { key: "phone", label: "Telefone", type: "text" },
    ],
    rows,
    summary: [{ label: "Aniversariantes", value: rows.length, type: "int" }],
  };
}

// 10. Inadimplência --------------------------------------------------------------------------------

async function inadimplencia(supabase: Supabase, f: ReportFilters): Promise<ReportResult> {
  const today = todayIso();
  const open = await fetchAll((a, b) => {
    let q = supabase
      .from("receivables")
      .select("id, amount_cents, due_date, patient_id, patients(full_name, phone, whatsapp)")
      .in("status", ["open", "overdue"])
      .lt("due_date", today)
      .order("id");
    if (f.unitId) q = q.eq("unit_id", f.unitId);
    if (f.professionalId) q = q.eq("professional_id", f.professionalId);
    return q.range(a, b);
  });
  const groups = new Map<string, Row>();
  for (const r of open) {
    const row = groupRows(groups, r.patient_id, () => ({ group: r.patients?.full_name ?? "Paciente", phone: r.patients?.whatsapp ?? r.patients?.phone ?? null, oldest: r.due_date, d30: 0, d60: 0, d90: 0, d90plus: 0, total: 0 }));
    const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${r.due_date}T00:00:00Z`)) / 86_400_000);
    const bucket = debtBucket(days);
    row[bucket] = Number(row[bucket]) + r.amount_cents;
    row.total = Number(row.total) + r.amount_cents;
    if (r.due_date < String(row.oldest)) row.oldest = r.due_date;
  }
  const rows = [...groups.values()].sort((a, b) => Number(b.total) - Number(a.total));
  return {
    columns: [
      { key: "group", label: "Paciente", type: "text" },
      { key: "phone", label: "Telefone", type: "text" },
      { key: "oldest", label: "Vencida desde", type: "date" },
      { key: "d30", label: "Até 30 dias", type: "money" },
      { key: "d60", label: "31 a 60", type: "money" },
      { key: "d90", label: "61 a 90", type: "money" },
      { key: "d90plus", label: "Mais de 90", type: "money" },
      { key: "total", label: "Total", type: "money" },
    ],
    rows,
    total: { group: "Total", phone: null, oldest: null, d30: sum(rows, "d30"), d60: sum(rows, "d60"), d90: sum(rows, "d90"), d90plus: sum(rows, "d90plus"), total: sum(rows, "total") },
    summary: [
      { label: "Em atraso", value: sum(rows, "total"), type: "money" },
      { label: "Pacientes", value: rows.length, type: "int" },
      { label: "Mais de 90 dias", value: sum(rows, "d90plus"), type: "money" },
    ],
  };
}

// 11. Despesas e DRE ---------------------------------------------------------------------------------

async function despesas(supabase: Supabase, f: ReportFilters): Promise<ReportResult> {
  const { start, end } = rangeOf(f);
  const [revenue, paidBills, cashOut, openBills] = await Promise.all([
    fetchAll((a, b) => {
      let q = supabase.from("receivables").select("paid_amount_cents, fee_cents").eq("status", "paid").gte("paid_at", start).lt("paid_at", end).order("id");
      if (f.unitId) q = q.eq("unit_id", f.unitId);
      return q.range(a, b);
    }),
    fetchAll((a, b) => {
      let q = supabase.from("payables").select("paid_amount_cents, finance_categories(name)").eq("status", "paid").gte("paid_at", start).lt("paid_at", end).order("id");
      if (f.unitId) q = q.eq("unit_id", f.unitId);
      return q.range(a, b);
    }),
    fetchAll((a, b) => {
      let q = supabase.from("cash_movements").select("amount_cents, finance_categories(name)").eq("type", "out").is("payable_id", null).is("receivable_id", null).gte("occurred_at", start).lt("occurred_at", end).order("id");
      if (f.unitId) q = q.eq("unit_id", f.unitId);
      return q.range(a, b);
    }),
    fetchAll((a, b) => {
      let q = supabase.from("payables").select("amount_cents, finance_categories(name)").in("status", ["open", "overdue"]).gte("due_date", f.from).lte("due_date", f.to).order("id");
      if (f.unitId) q = q.eq("unit_id", f.unitId);
      return q.range(a, b);
    }),
  ]);
  const dre = buildDre({
    revenue: revenue.map((x) => ({ amountCents: x.paid_amount_cents ?? 0, feeCents: x.fee_cents })),
    expenses: [
      ...paidBills.map((x) => ({ category: x.finance_categories?.name ?? "Sem categoria", amountCents: x.paid_amount_cents ?? 0 })),
      ...cashOut.map((x) => ({ category: x.finance_categories?.name ?? "Sem categoria", amountCents: x.amount_cents })),
    ],
  });
  const groups = new Map<string, Row>();
  for (const e of dre.expenses) groupRows(groups, e.category, () => ({ group: e.category, paid: 0, open: 0 })).paid = e.amountCents;
  for (const b of openBills) {
    const key = b.finance_categories?.name ?? "Sem categoria";
    const row = groupRows(groups, key, () => ({ group: key, paid: 0, open: 0 }));
    row.open = Number(row.open) + b.amount_cents;
  }
  const rows = [...groups.values()].sort((a, b) => Number(b.paid) - Number(a.paid));
  return {
    columns: [
      { key: "group", label: "Categoria", type: "text" },
      { key: "paid", label: "Pago no período", type: "money" },
      { key: "open", label: "A pagar (vence no período)", type: "money" },
    ],
    rows,
    total: { group: "Total", paid: sum(rows, "paid"), open: sum(rows, "open") },
    summary: [
      { label: "Receita bruta", value: dre.grossRevenue, type: "money" },
      { label: "Taxas", value: dre.fees, type: "money" },
      { label: "Despesas pagas", value: dre.totalExpenses, type: "money" },
      { label: "Resultado", value: dre.result, type: "money" },
    ],
    note: "DRE gerencial em regime de caixa: recebido − taxas − despesas pagas (contas e saídas avulsas do caixa).",
  };
}

// 12. Comissões ----------------------------------------------------------------------------------------

async function comissoes(supabase: Supabase, f: ReportFilters): Promise<ReportResult> {
  const months: string[] = [];
  for (let m = f.from.slice(0, 7); m <= f.to.slice(0, 7) && months.length < 12; ) {
    months.push(m);
    const [y, mo] = m.split("-").map(Number) as [number, number];
    m = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  }
  let q = supabase.from("professionals").select("id, name").eq("active", true).order("name");
  if (f.professionalId) q = q.eq("id", f.professionalId);
  const { data: pros } = await q;
  const rows: Row[] = [];
  for (const p of pros ?? []) {
    for (const month of months) {
      const st = await getStatement(p.id, month);
      if (!st) continue;
      if (!st.statement.lines.length && !st.closing) continue;
      rows.push({
        group: p.name,
        month,
        gross: st.closing ? st.closing.total_gross_cents : st.statement.grossCents,
        base: st.closing ? st.closing.total_base_cents : st.statement.baseCents,
        commission: st.closing ? st.closing.total_commission_cents : st.statement.commissionCents,
        status: st.closing ? "Fechado" : "Em aberto",
      });
    }
  }
  return {
    columns: [
      { key: "group", label: "Profissional", type: "text" },
      { key: "month", label: "Mês", type: "text" },
      { key: "gross", label: "Bruto", type: "money" },
      { key: "base", label: "Base de cálculo", type: "money" },
      { key: "commission", label: "Comissão", type: "money" },
      { key: "status", label: "Situação", type: "text" },
    ],
    rows,
    total: { group: "Total", month: null, gross: sum(rows, "gross"), base: sum(rows, "base"), commission: sum(rows, "commission"), status: null },
    summary: [{ label: "Comissões", value: sum(rows, "commission"), type: "money" }],
    note: "Meses fechados usam os valores congelados no fechamento. Até 12 meses.",
  };
}

// 13. Retornos ---------------------------------------------------------------------------------------------

async function retornos(supabase: Supabase, f: ReportFilters): Promise<ReportResult> {
  const today = todayIso();
  const list = await fetchAll((a, b) => {
    let q = supabase.from("patient_returns").select("id, status, due_date, professionals(name)").gte("due_date", f.from).lte("due_date", f.to).order("id");
    if (f.professionalId) q = q.eq("professional_id", f.professionalId);
    return q.range(a, b);
  });
  const groups = new Map<string, Row>();
  for (const r of list) {
    const key = r.professionals?.name ?? "Sem profissional";
    const row = groupRows(groups, key, () => ({ group: key, total: 0, kept: 0, overdue: 0, upcoming: 0, dismissed: 0 }));
    row.total = Number(row.total) + 1;
    if (r.status === "scheduled" || r.status === "done") row.kept = Number(row.kept) + 1;
    else if (r.status === "dismissed") row.dismissed = Number(row.dismissed) + 1;
    else if (r.due_date <= today) row.overdue = Number(row.overdue) + 1;
    else row.upcoming = Number(row.upcoming) + 1;
  }
  const rows = [...groups.values()].map((r): Row => ({ ...r, rate: ratio(Number(r.kept), Number(r.kept) + Number(r.overdue) + Number(r.dismissed)) }));
  const kept = sum(rows, "kept");
  const closed = kept + sum(rows, "overdue") + sum(rows, "dismissed");
  return {
    columns: [
      { key: "group", label: "Profissional", type: "text" },
      { key: "total", label: "Retornos", type: "int" },
      { key: "kept", label: "Cumpridos", type: "int" },
      { key: "overdue", label: "Vencidos sem consulta", type: "int" },
      { key: "upcoming", label: "A vencer", type: "int" },
      { key: "dismissed", label: "Dispensados", type: "int" },
      { key: "rate", label: "Cumprimento", type: "percent" },
    ],
    rows,
    total: { group: "Total", total: sum(rows, "total"), kept, overdue: sum(rows, "overdue"), upcoming: sum(rows, "upcoming"), dismissed: sum(rows, "dismissed"), rate: ratio(kept, closed) },
    summary: [
      { label: "Cumpridos", value: kept, type: "int" },
      { label: "Vencidos sem consulta", value: sum(rows, "overdue"), type: "int" },
      { label: "Cumprimento", value: ratio(kept, closed) ?? 0, type: "percent" },
    ],
    note: "Retornos com vencimento no período. Cumprido = paciente marcou consulta (ou retorno concluído).",
  };
}

// 14. CRC e CRM -----------------------------------------------------------------------------------------------

async function crcCrm(supabase: Supabase, f: ReportFilters): Promise<ReportResult> {
  const [{ data: stats }, crm] = await Promise.all([supabase.rpc("crc_stats", { _from: f.from, _to: f.to }), getCrmReport(f.from, f.to)]);
  const rows: Row[] = [];
  for (const q of crcQueues) {
    const s = stats?.find((x) => x.queue === q);
    rows.push({ area: "CRC", group: queueLabels[q], count: s?.contacted ?? 0, success: q === "birthdays" ? null : (s?.recovered ?? 0), rate: q === "birthdays" ? null : ratio(s?.recovered ?? 0, s?.contacted ?? 0), value: q === "birthdays" ? null : Number(s?.recovered_cents ?? 0) });
  }
  for (const s of crm.bySource) rows.push({ area: "CRM", group: s.name, count: s.leads, success: s.won, rate: ratio(s.won, s.leads), value: null });
  const crcRows = rows.filter((r) => r.area === "CRC");
  return {
    columns: [
      { key: "area", label: "Área", type: "text" },
      { key: "group", label: "Fila / origem", type: "text" },
      { key: "count", label: "Contatados / leads", type: "int" },
      { key: "success", label: "Recuperados / fecharam", type: "int" },
      { key: "rate", label: "Taxa", type: "percent" },
      { key: "value", label: "Valor recuperado", type: "money" },
    ],
    rows,
    summary: [
      { label: "Pacientes contatados (CRC)", value: sum(crcRows, "count"), type: "int" },
      { label: "Valor recuperado (CRC)", value: sum(crcRows, "value"), type: "money" },
      { label: "Leads (CRM)", value: crm.total, type: "int" },
    ],
    note: "Detalhes em CRC > Indicadores e CRM > Conversão.",
  };
}

// 15. Consumo de material -----------------------------------------------------------------------------------

async function consumo(supabase: Supabase, f: ReportFilters): Promise<ReportResult> {
  const { start, end } = rangeOf(f);
  const moves = await fetchAll((a, b) => {
    let q = supabase
      .from("stock_movements")
      .select("qty, unit_cost_cents, shortage, treatment_item_id, stock_products(name, measure), treatment_items(procedures(name), description)")
      .in("kind", ["procedure", "manual_out"])
      .gte("created_at", start)
      .lt("created_at", end)
      .order("id");
    if (f.unitId) q = q.eq("unit_id", f.unitId);
    return q.range(a, b);
  });
  const groups = new Map<string, { row: Row; items: Set<string> }>();
  for (const m of moves) {
    const byProduct = f.groupBy === "produto";
    const key = byProduct
      ? `${m.stock_products?.name ?? "Produto"}${m.stock_products?.measure ? ` (${m.stock_products.measure})` : ""}`
      : m.treatment_item_id
        ? (m.treatment_items?.procedures?.name ?? m.treatment_items?.description ?? "Procedimento")
        : "Saídas manuais";
    const g = groups.get(key) ?? { row: { group: key, procedures: 0, qty: 0, cost: 0 }, items: new Set<string>() };
    groups.set(key, g);
    if (m.treatment_item_id) g.items.add(m.treatment_item_id);
    g.row.qty = Number(g.row.qty) + -Number(m.qty);
    // Custo só do que saiu de lote (a falta não tem custo conhecido).
    g.row.cost = Number(g.row.cost) + Math.round((-Number(m.qty) - Number(m.shortage)) * m.unit_cost_cents);
  }
  const rows: Row[] = [...groups.values()]
    .map(({ row, items }): Row => ({ ...row, procedures: items.size, perProcedure: items.size ? Math.round(Number(row.cost) / items.size) : null }))
    .sort((a, b) => Number(b.cost) - Number(a.cost));
  const byProduct = f.groupBy === "produto";
  return {
    columns: [
      { key: "group", label: byProduct ? "Material" : "Procedimento", type: "text" },
      ...(byProduct ? [{ key: "qty", label: "Quantidade", type: "decimal" as const }] : [{ key: "procedures", label: "Realizados", type: "int" as const }]),
      { key: "cost", label: "Custo de material", type: "money" },
      ...(byProduct ? [] : [{ key: "perProcedure", label: "Custo por procedimento", type: "money" as const }]),
    ],
    rows,
    total: { group: "Total", qty: sum(rows, "qty"), procedures: sum(rows, "procedures"), cost: sum(rows, "cost"), perProcedure: null },
    summary: [{ label: "Custo de material", value: sum(rows, "cost"), type: "money" }],
    note: "Baixas pelos kits ao realizar procedimentos e saídas manuais. Custo pelo valor de compra de cada lote.",
  };
}

/**
 * Avaliações no Google (P10, sem a API): consultas atendidas e pedidos de
 * avaliação enviados por profissional. Nota média, total e avaliações novas
 * dependem da API do Google Business Profile (pendente).
 */
async function avaliacoesGoogle(supabase: Supabase, f: ReportFilters): Promise<ReportResult> {
  const { start, end } = rangeOf(f);
  const [appts, logs] = await Promise.all([
    fetchAll((a, b) => {
      let q = supabase.from("appointments").select("id, professionals(name)").eq("status", "done").gte("starts_at", start).lt("starts_at", end).order("id");
      if (f.professionalId) q = q.eq("professional_id", f.professionalId);
      return q.range(a, b);
    }),
    fetchAll((a, b) =>
      supabase
        .from("messages_log")
        .select("id, status, appointments(professional_id, professionals(name))")
        .eq("template_kind", "review_request")
        .neq("status", "failed")
        .gte("sent_at", start)
        .lt("sent_at", end)
        .order("id")
        .range(a, b),
    ),
  ]);
  const groups = new Map<string, Row>();
  for (const a of appts) {
    const key = a.professionals?.name ?? "Profissional";
    const row = groupRows(groups, key, () => ({ group: key, attended: 0, requests: 0 }));
    row.attended = Number(row.attended) + 1;
  }
  for (const l of logs) {
    if (f.professionalId && l.appointments?.professional_id !== f.professionalId) continue;
    const key = l.appointments?.professionals?.name ?? "Profissional";
    const row = groupRows(groups, key, () => ({ group: key, attended: 0, requests: 0 }));
    row.requests = Number(row.requests) + 1;
  }
  const rows = [...groups.values()].map((r): Row => ({ ...r, rate: ratio(Number(r.requests), Number(r.attended)) }));
  const attended = sum(rows, "attended");
  const requests = sum(rows, "requests");
  return {
    columns: [
      { key: "group", label: "Profissional", type: "text" },
      { key: "attended", label: "Atendidos", type: "int" },
      { key: "requests", label: "Pedidos de avaliação", type: "int" },
      { key: "rate", label: "Pedidos por atendido", type: "percent" },
    ],
    rows,
    total: { group: "Total", attended, requests, rate: ratio(requests, attended) },
    summary: [
      { label: "Pedidos de avaliação", value: requests, type: "int" },
      { label: "Atendidos", value: attended, type: "int" },
    ],
    note: "Pedidos enviados pelo WhatsApp depois do Atendido (ligue o modelo em Mensagens automáticas e cadastre o link em Dados da clínica). Para pedir na hora, use Mais > Pedir avaliação no Google na ficha do paciente. Nota média, total e avaliações novas virão com a integração com o Google Business Profile, que depende de aprovação do Google.",
  };
}

const runners: Record<string, (supabase: Supabase, f: ReportFilters) => Promise<ReportResult>> = {
  "avaliacoes-google": avaliacoesGoogle,
  consumo,
  faturamento,
  producao,
  orcamentos,
  "primeira-consulta": primeiraConsulta,
  pacientes,
  faltas,
  ocupacao,
  "sem-visita": semVisita,
  aniversariantes,
  inadimplencia,
  despesas,
  comissoes,
  retornos,
  "crc-crm": crcCrm,
};

export async function runReport(slug: string, filters: ReportFilters): Promise<ReportResult | null> {
  return runReportWith(await createClient(), slug, filters);
}

/** Mesmo relatório com um cliente já autenticado (testes). */
export async function runReportWith(supabase: Supabase, slug: string, filters: ReportFilters): Promise<ReportResult | null> {
  const runner = runners[slug];
  return runner ? runner(supabase, filters) : null;
}
