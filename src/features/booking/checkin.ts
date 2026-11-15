import "server-only";

import { firstName } from "@/lib/messaging/render";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDays, utcToZoned, zonedToUtc } from "@/lib/timezone";

import { normalizePhone } from "./slots";

export type CheckinUnit = { unitId: string; clinicId: string; unitName: string; clinicName: string };

/** Unidade do QR Code da recepção. */
export async function loadCheckinUnit(token: string): Promise<CheckinUnit | null> {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("units").select("id, clinic_id, name, active, clinics(name)").eq("checkin_token", token).maybeSingle();
  if (!data || !data.active) return null;
  return { unitId: data.id, clinicId: data.clinic_id, unitName: data.name, clinicName: data.clinics?.name ?? "" };
}

/**
 * Consultas de hoje na unidade para o telefone informado. Só devolve o
 * primeiro nome e o horário (nada mais sobre o paciente).
 */
export async function findTodayAppointments(unit: CheckinUnit, phoneInput: string) {
  const phone = normalizePhone(phoneInput);
  if (!phone) return { error: "Telefone inválido. Digite com DDD." as const };
  const admin = createAdminClient();
  const today = utcToZoned(new Date()).date;
  const { data: patients } = await admin
    .from("patients")
    .select("id, full_name")
    .eq("clinic_id", unit.clinicId)
    .is("archived_at", null)
    .or(`phone.eq.${phone},whatsapp.eq.${phone}`);
  if (!patients?.length) return { appointments: [] };
  const { data: appts } = await admin
    .from("appointments")
    .select("id, patient_id, starts_at, status")
    .eq("unit_id", unit.unitId)
    .in("patient_id", patients.map((p) => p.id))
    .in("status", ["scheduled", "confirmed"])
    .gte("starts_at", zonedToUtc(today, "00:00").toISOString())
    .lt("starts_at", zonedToUtc(addDays(today, 1), "00:00").toISOString())
    .order("starts_at");
  const names = new Map(patients.map((p) => [p.id, firstName(p.full_name)]));
  return { appointments: (appts ?? []).map((a) => ({ id: a.id, firstName: names.get(a.patient_id) ?? "", time: utcToZoned(a.starts_at).time })) };
}

/** Marca "chegou" — de novo confere telefone, unidade e dia. */
export async function checkIn(unit: CheckinUnit, appointmentId: string, phoneInput: string): Promise<{ error?: string }> {
  const found = await findTodayAppointments(unit, phoneInput);
  if ("error" in found) return { error: found.error };
  if (!found.appointments.some((a) => a.id === appointmentId)) return { error: "Consulta não encontrada para hoje." };
  const { error } = await createAdminClient().from("appointments").update({ status: "arrived" }).eq("id", appointmentId).in("status", ["scheduled", "confirmed"]);
  if (error) return { error: "Não foi possível fazer o check-in. Fale com a recepção." };
  return {};
}
