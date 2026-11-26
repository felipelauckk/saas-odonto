import "server-only";

import { fetchAll } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { addDays, timeToMinutes, utcToZoned, zonedToUtc } from "@/lib/timezone";

import type { Period } from "./advanced";
import type { AppointmentStatus } from "./labels";
import type { ConfirmationMode, ReminderMode } from "./schemas";
import { monthOccupancy, occupancyLevel, pickFreedSlot } from "./overview";

export type AgendaAppointment = {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  professionalId: string;
  chairId: string | null;
  /** Procedimentos da consulta, na ordem (appointment_procedures). */
  procedures: AgendaProcedure[];
  status: AppointmentStatus;
  type: string | null;
  notes: string | null;
  tagIds: string[];
  confirmationMode: ConfirmationMode;
  reminderMode: ReminderMode;
  isFirstVisit: boolean;
  arrivedAt: string | null;
  cancelReason: string | null;
  bookedOnline: boolean;
  rescheduleRequestedAt: string | null;
  /** Horário de parede em São Paulo. */
  date: string;
  startMin: number;
  endMin: number;
  startsAt: string;
  endsAt: string;
};

export type AgendaProcedure = { procedureId: string; name: string; treatmentItemId: string | null; tooth: number | null; faces: string[] | null };

export type AgendaBlock = {
  id: string;
  professionalId: string | null;
  date: string;
  startMin: number;
  endMin: number;
  reason: string | null;
};

export type AgendaData = {
  professionals: { id: string; name: string; color: string }[];
  chairs: { id: string; name: string }[];
  procedures: { id: string; name: string; duration_min: number; return_months: number | null; category: string | null; applies_to_tooth: boolean }[];
  tags: { id: string; name: string; color: string }[];
  schedules: { professional_id: string; weekday: number; start_time: string; end_time: string }[];
  appointments: AgendaAppointment[];
  blocks: AgendaBlock[];
};

/** Divide um intervalo que atravessa a meia-noite em pedaços por dia. */
function splitByDay(startsAt: string, endsAt: string) {
  const start = utcToZoned(startsAt);
  const end = utcToZoned(endsAt);
  const pieces: { date: string; startMin: number; endMin: number }[] = [];
  let date = start.date;
  while (date <= end.date) {
    pieces.push({
      date,
      startMin: date === start.date ? start.minutes : 0,
      endMin: date === end.date ? end.minutes : 24 * 60,
    });
    date = addDays(date, 1);
  }
  return pieces.filter((p) => p.endMin > p.startMin);
}

/**
 * Tudo que a agenda precisa para um período de uma unidade.
 * A RLS já filtra: dentista só recebe a própria agenda; recepção, as unidades permitidas.
 */
export async function getAgendaData({
  unitId,
  from,
  days,
  isDentist,
}: {
  unitId: string;
  from: string;
  days: number;
  isDentist: boolean;
}): Promise<AgendaData> {
  const supabase = await createClient();
  const rangeStart = zonedToUtc(from, "00:00").toISOString();
  const rangeEnd = zonedToUtc(addDays(from, days), "00:00").toISOString();

  const [prosRes, ownRes, chairsRes, proceduresRes, schedulesRes, apptRes, blocksRes] = await Promise.all([
    supabase.from("professionals").select("id, name, color").eq("active", true).order("name"),
    isDentist ? supabase.rpc("current_professional_ids") : Promise.resolve({ data: null, error: null }),
    supabase.from("chairs").select("id, name").eq("unit_id", unitId).eq("active", true).order("name"),
    supabase.from("procedures").select("id, name, duration_min, return_months, category, applies_to_tooth").eq("active", true).order("name"),
    supabase
      .from("professional_schedules")
      .select("professional_id, weekday, start_time, end_time")
      .eq("unit_id", unitId),
    supabase
      .from("appointments")
      .select(
        "id, patient_id, professional_id, chair_id, starts_at, ends_at, status, type, notes, confirmation_mode, reminder_mode, is_first_visit, arrived_at, cancel_reason, booked_online, reschedule_requested_at, patients(full_name, phone, whatsapp), appointment_tag_links(tag_id), appointment_procedures(procedure_id, treatment_item_id, tooth, faces, position, procedures(name))",
      )
      .eq("unit_id", unitId)
      .lt("starts_at", rangeEnd)
      .gt("ends_at", rangeStart)
      .order("starts_at"),
    supabase
      .from("schedule_blocks")
      .select("id, professional_id, starts_at, ends_at, reason")
      .eq("unit_id", unitId)
      .lt("starts_at", rangeEnd)
      .gt("ends_at", rangeStart),
  ]);

  const { data: tagRows } = await supabase.from("appointment_tags").select("id, name, color").eq("active", true).order("name");
  for (const res of [prosRes, chairsRes, proceduresRes, schedulesRes, apptRes, blocksRes]) {
    if (res.error) throw res.error;
  }

  const ownIds = ownRes.data ? new Set(ownRes.data as string[]) : null;
  const professionals = (prosRes.data ?? []).filter((p) => !ownIds || ownIds.has(p.id));

  const appointments: AgendaAppointment[] = (apptRes.data ?? []).flatMap((a) =>
    splitByDay(a.starts_at, a.ends_at).map((piece) => ({
      id: a.id,
      patientId: a.patient_id,
      patientName: a.patients?.full_name ?? "Paciente",
      patientPhone: a.patients?.whatsapp ?? a.patients?.phone ?? null,
      professionalId: a.professional_id,
      chairId: a.chair_id,
      procedures: [...a.appointment_procedures]
        .sort((x, y) => x.position - y.position)
        .map((p) => ({ procedureId: p.procedure_id, name: p.procedures?.name ?? "Procedimento", treatmentItemId: p.treatment_item_id, tooth: p.tooth, faces: p.faces })),
      confirmationMode: a.confirmation_mode as ConfirmationMode,
      reminderMode: a.reminder_mode as ReminderMode,
      status: a.status,
      type: a.type,
      notes: a.notes,
      tagIds: a.appointment_tag_links.map((l) => l.tag_id),
      isFirstVisit: a.is_first_visit,
      arrivedAt: a.arrived_at,
      cancelReason: a.cancel_reason,
      bookedOnline: a.booked_online,
      rescheduleRequestedAt: a.reschedule_requested_at,
      startsAt: a.starts_at,
      endsAt: a.ends_at,
      ...piece,
    })),
  );

  const blocks: AgendaBlock[] = (blocksRes.data ?? []).flatMap((b) =>
    splitByDay(b.starts_at, b.ends_at).map((piece) => ({
      id: b.id,
      professionalId: b.professional_id,
      reason: b.reason,
      ...piece,
    })),
  );

  return {
    professionals,
    chairs: chairsRes.data ?? [],
    procedures: proceduresRes.data ?? [],
    tags: tagRows ?? [],
    schedules: schedulesRes.data ?? [],
    appointments,
    blocks,
  };
}

/** Consultas de um paciente (aba Agendamentos da ficha). */
export async function listPatientAppointments(patientId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("id, starts_at, ends_at, status, type, professionals(name, color), units(name)")
    .eq("patient_id", patientId)
    .order("starts_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data;
}

/** Relatório de faltas, desmarcações e marcadores no período. */
export async function getAttendanceReport({ from, to, professionalId }: { from: string; to: string; professionalId: string | null }) {
  const supabase = await createClient();
  let query = supabase
    .from("appointments")
    .select("id, starts_at, status, cancel_reason, cancel_note, patient_id, professional_id, patients(full_name, phone, whatsapp), professionals(name), appointment_tag_links(appointment_tags(name, color))")
    .gte("starts_at", zonedToUtc(from, "00:00").toISOString())
    .lt("starts_at", zonedToUtc(addDays(to, 1), "00:00").toISOString())
    .order("starts_at", { ascending: false });
  if (professionalId) query = query.eq("professional_id", professionalId);
  const { data, error } = await query;
  if (error) throw error;
  const rows = data ?? [];
  const now = new Date().toISOString();

  const byProfessional = new Map<string, { name: string; total: number; noShow: number; canceled: number }>();
  const byTag = new Map<string, { name: string; color: string; total: number }>();
  for (const a of rows) {
    const p = byProfessional.get(a.professional_id) ?? { name: a.professionals?.name ?? "", total: 0, noShow: 0, canceled: 0 };
    if (a.starts_at < now || a.status === "canceled") p.total++;
    if (a.status === "no_show") p.noShow++;
    if (a.status === "canceled") p.canceled++;
    byProfessional.set(a.professional_id, p);
    for (const link of a.appointment_tag_links) {
      const tag = link.appointment_tags;
      if (!tag) continue;
      const t = byTag.get(tag.name) ?? { name: tag.name, color: tag.color, total: 0 };
      t.total++;
      byTag.set(tag.name, t);
    }
  }
  return {
    events: rows.filter((a) => a.status === "no_show" || a.status === "canceled"),
    pastNotCanceled: rows.filter((a) => a.starts_at < now && a.status !== "canceled").length,
    byProfessional: [...byProfessional.values()].sort((a, b) => a.name.localeCompare(b.name)),
    byTag: [...byTag.values()].sort((a, b) => b.total - a.total),
  };
}

// --- Visão geral da agenda (R4): mini calendário, sala de espera e vaga liberada. ---

/**
 * Tom de ocupação de cada dia do mês na unidade (0 a 3). Só conta os
 * profissionais visíveis para quem pede (dentista: só os próprios).
 */
export async function getMonthOccupancy(unitId: string, month: string, professionalIds: string[]) {
  const supabase = await createClient();
  const first = `${month}-01`;
  const next = `${addDays(first, 31).slice(0, 7)}-01`; // 1º do mês seguinte
  const [appts, schedules] = await Promise.all([
    fetchAll((a, b) =>
      supabase
        .from("appointments")
        .select("professional_id, starts_at, ends_at, status")
        .eq("unit_id", unitId)
        .not("status", "in", "(canceled,no_show)")
        .gte("starts_at", zonedToUtc(first, "00:00").toISOString())
        .lt("starts_at", zonedToUtc(next, "00:00").toISOString())
        .order("id")
        .range(a, b),
    ),
    supabase.from("professional_schedules").select("professional_id, weekday, start_time, end_time").eq("unit_id", unitId),
  ]);
  if (schedules.error) throw schedules.error;
  const allowed = new Set(professionalIds);
  const occ = monthOccupancy(
    month,
    appts
      .filter((a) => allowed.has(a.professional_id))
      .map((a) => {
        const start = utcToZoned(a.starts_at);
        const end = utcToZoned(a.ends_at);
        return { date: start.date, professionalId: a.professional_id, status: a.status, startMin: start.minutes, endMin: end.date === start.date ? end.minutes : 24 * 60 };
      }),
    (schedules.data ?? [])
      .filter((s) => allowed.has(s.professional_id))
      .map((s) => ({ professionalId: s.professional_id, weekday: s.weekday, startMin: timeToMinutes(s.start_time), endMin: timeToMinutes(s.end_time) })),
  );
  return new Map([...occ].map(([date, ratio]) => [date, occupancyLevel(ratio)]));
}

export type WaitingRow = { id: string; patientName: string; professionalName: string; scheduledTime: string; arrivedAt: string; isFirstVisit: boolean };

/** Quem chegou hoje e aguarda atendimento na unidade. */
export async function getWaitingRoom(unitId: string, today: string): Promise<WaitingRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("id, starts_at, arrived_at, is_first_visit, patients(full_name), professionals(name)")
    .eq("unit_id", unitId)
    .eq("status", "arrived")
    .gte("starts_at", zonedToUtc(today, "00:00").toISOString())
    .lt("starts_at", zonedToUtc(addDays(today, 1), "00:00").toISOString())
    .order("arrived_at");
  if (error) throw error;
  return (data ?? []).map((a) => ({
    id: a.id,
    patientName: a.patients?.full_name ?? "",
    professionalName: a.professionals?.name ?? "",
    scheduledTime: utcToZoned(a.starts_at).time,
    arrivedAt: a.arrived_at ?? a.starts_at,
    isFirstVisit: a.is_first_visit,
  }));
}

/** A vaga liberada mais próxima (próximos 7 dias) com quem da lista de espera cabe nela. */
export async function getFreedSlot(unitId: string, now: Date = new Date()) {
  const supabase = await createClient();
  const from = now.toISOString();
  const to = zonedToUtc(addDays(utcToZoned(now).date, 8), "00:00").toISOString();
  const [canceledRes, busyRes, waitRes, prosRes] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, professional_id, unit_id, starts_at, ends_at")
      .eq("unit_id", unitId)
      .eq("status", "canceled")
      .gt("starts_at", from)
      .lt("starts_at", to)
      .order("starts_at")
      .limit(50),
    supabase
      .from("appointments")
      .select("professional_id, starts_at, ends_at")
      .eq("unit_id", unitId)
      .not("status", "in", "(canceled,no_show)")
      .lt("starts_at", to)
      .gt("ends_at", from)
      .limit(2000),
    supabase.from("waitlist").select("id, unit_id, professional_id, period, notes, patients(full_name)").eq("status", "waiting").order("created_at"),
    supabase.from("professionals").select("id, name"),
  ]);
  for (const r of [canceledRes, busyRes, waitRes, prosRes]) if (r.error) throw r.error;

  const toInterval = (startsAt: string, endsAt: string) => {
    const s = utcToZoned(startsAt);
    const e = utcToZoned(endsAt);
    return { date: s.date, startMin: s.minutes, endMin: e.date === s.date ? e.minutes : 24 * 60 };
  };
  const picked = pickFreedSlot(
    (canceledRes.data ?? []).map((c) => ({ id: c.id, unitId: c.unit_id, professionalId: c.professional_id, ...toInterval(c.starts_at, c.ends_at) })),
    (busyRes.data ?? []).map((b) => ({ professionalId: b.professional_id, ...toInterval(b.starts_at, b.ends_at) })),
    (waitRes.data ?? []).map((w) => ({
      id: w.id,
      unitId: w.unit_id,
      professionalId: w.professional_id,
      period: w.period as Period,
      patientName: w.patients?.full_name ?? "Paciente",
      notes: w.notes,
    })),
  );
  if (!picked) return null;
  const professionalName = (prosRes.data ?? []).find((p) => p.id === picked.slot.professionalId)?.name ?? "Profissional";
  return { ...picked, professionalName };
}
