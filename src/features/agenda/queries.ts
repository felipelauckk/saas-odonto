import "server-only";

import { createClient } from "@/lib/supabase/server";
import { addDays, utcToZoned, zonedToUtc } from "@/lib/timezone";

import type { AppointmentStatus } from "./labels";

export type AgendaAppointment = {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  professionalId: string;
  chairId: string | null;
  procedureId: string | null;
  status: AppointmentStatus;
  type: string | null;
  notes: string | null;
  /** Horário de parede em São Paulo. */
  date: string;
  startMin: number;
  endMin: number;
  startsAt: string;
  endsAt: string;
};

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
  procedures: { id: string; name: string; duration_min: number }[];
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
    supabase.from("procedures").select("id, name, duration_min").eq("active", true).order("name"),
    supabase
      .from("professional_schedules")
      .select("professional_id, weekday, start_time, end_time")
      .eq("unit_id", unitId),
    supabase
      .from("appointments")
      .select(
        "id, patient_id, professional_id, chair_id, procedure_id, starts_at, ends_at, status, type, notes, patients(full_name, phone, whatsapp)",
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
      procedureId: a.procedure_id,
      status: a.status,
      type: a.type,
      notes: a.notes,
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
    schedules: schedulesRes.data ?? [],
    appointments,
    blocks,
  };
}

/** Faltas num período (relatório). */
export async function listNoShows({ from, to }: { from: string; to: string }) {
  const supabase = await createClient();
  const rangeStart = zonedToUtc(from, "00:00").toISOString();
  const rangeEnd = zonedToUtc(addDays(to, 1), "00:00").toISOString();

  const [noShows, totals] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, starts_at, patient_id, patients(full_name, phone, whatsapp), professionals(name, color), units(name)")
      .eq("status", "no_show")
      .gte("starts_at", rangeStart)
      .lt("starts_at", rangeEnd)
      .order("starts_at", { ascending: false }),
    // Base da taxa: consultas que aconteceram ou deveriam ter acontecido (sem canceladas).
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .neq("status", "canceled")
      .gte("starts_at", rangeStart)
      .lt("starts_at", rangeEnd)
      .lt("starts_at", new Date().toISOString()),
  ]);
  if (noShows.error) throw noShows.error;
  return { rows: noShows.data, base: totals.count ?? 0 };
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
