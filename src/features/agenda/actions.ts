"use server";

import type { PostgrestError } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { subscriptionErrorMessage } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";
import { addDays, zonedToUtc } from "@/lib/timezone";
import { addMonths } from "@/lib/installments";
import { randomUUID } from "node:crypto";

import { fitsWaitlist, seriesDates } from "./advanced";
import { utcToZoned } from "@/lib/timezone";
import { getSessionContext } from "@/features/tenancy/queries";

import { appointmentSchema, blockSchema, moveAppointmentSchema, statusSchema } from "./schemas";

type Result = { error?: string; id?: string };

const AGENDA_PATH = "/agenda";

/** Mensagem clara para conflitos e bloqueios vindos do banco. */
function agendaError(error: PostgrestError): string {
  const blocked = subscriptionErrorMessage(error);
  if (blocked) return blocked;
  if (error.code === "23P01") {
    return error.message.includes("chair")
      ? "A cadeira já está ocupada nesse horário."
      : "O profissional já tem consulta nesse horário.";
  }
  if (error.code === "OB001" || error.code === "OA001") return error.message;
  if (error.code === "42501") return "Você não tem permissão para mexer nesta agenda.";
  if (error.code === "23503") return "Algum item escolhido não existe mais. Recarregue a página.";
  return "Não foi possível salvar. Tente novamente.";
}

async function activeContext() {
  const session = await getSessionContext();
  if (!session?.clinic || !session.activeUnit) return null;
  return { session, clinicId: session.clinic.id, unitId: session.activeUnit.id, supabase: await createClient() };
}

function interval(date: string, time: string, durationMin: number) {
  const startsAt = zonedToUtc(date, time);
  const endsAt = new Date(startsAt.getTime() + durationMin * 60_000);
  return { starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString() };
}

async function setTags(supabase: Awaited<ReturnType<typeof createClient>>, clinicId: string, appointmentId: string, tagIds: string[] | undefined) {
  if (!tagIds) return;
  await supabase.from("appointment_tag_links").delete().eq("appointment_id", appointmentId);
  if (tagIds.length) {
    await supabase.from("appointment_tag_links").insert(tagIds.map((tag_id) => ({ appointment_id: appointmentId, tag_id, clinic_id: clinicId })));
  }
}

export async function saveAppointment(input: z.input<typeof appointmentSchema>): Promise<Result & { failed?: { date: string; reason: string }[]; created?: number }> {
  const parsed = appointmentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const ctx = await activeContext();
  if (!ctx) return { error: "Sessão expirada. Entre novamente." };

  const { id, patientId, professionalId, chairId, procedureId, date, time, durationMin, type, notes, tagIds, repeat, repeatCount } = parsed.data;
  const row = { professional_id: professionalId, chair_id: chairId, procedure_id: procedureId, type, notes };

  if (id) {
    const { data, error } = await ctx.supabase.from("appointments").update({ ...row, ...interval(date, time, durationMin), reschedule_requested_at: null }).eq("id", id).select("id");
    if (error) return { error: agendaError(error) };
    if (!data.length) return { error: "Consulta não encontrada ou sem permissão." };
    await setTags(ctx.supabase, ctx.clinicId, id, tagIds);
    revalidatePath(AGENDA_PATH);
    return { id };
  }

  // Série: cada data é marcada separadamente; as que conflitam ficam de fora.
  const dates = repeat && repeatCount ? seriesDates(date, repeat, repeatCount) : [date];
  const seriesId = dates.length > 1 ? randomUUID() : null;
  const failed: { date: string; reason: string }[] = [];
  let firstId: string | undefined;
  for (const day of dates) {
    const { data, error } = await ctx.supabase
      .from("appointments")
      .insert({ ...row, ...interval(day, time, durationMin), clinic_id: ctx.clinicId, unit_id: ctx.unitId, patient_id: patientId, created_by: ctx.session.user.id, series_id: seriesId })
      .select("id")
      .single();
    if (error) {
      failed.push({ date: day, reason: agendaError(error) });
      continue;
    }
    firstId ??= data.id;
    await setTags(ctx.supabase, ctx.clinicId, data.id, tagIds);
  }
  revalidatePath(AGENDA_PATH);
  if (!firstId) return { error: failed[0]?.reason ?? "Não foi possível marcar.", failed };
  return { id: firstId, failed, created: dates.length - failed.length };
}

/** Arrastar na grade: muda o horário (mantém a duração) e, se for o caso, o profissional ou a cadeira. */
export async function moveAppointment(input: z.input<typeof moveAppointmentSchema>): Promise<Result> {
  const parsed = moveAppointmentSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos." };
  const ctx = await activeContext();
  if (!ctx) return { error: "Sessão expirada. Entre novamente." };

  const { id, date, time, professionalId, chairId } = parsed.data;
  const { data: current } = await ctx.supabase
    .from("appointments")
    .select("starts_at, ends_at")
    .eq("id", id)
    .maybeSingle();
  if (!current) return { error: "Consulta não encontrada." };

  const duration = (new Date(current.ends_at).getTime() - new Date(current.starts_at).getTime()) / 60_000;
  const { data, error } = await ctx.supabase
    .from("appointments")
    .update({
      ...interval(date, time, duration),
      // Remarcada pela clínica: o pedido de remarcação do portal está atendido.
      reschedule_requested_at: null,
      ...(professionalId ? { professional_id: professionalId } : {}),
      ...(chairId !== undefined ? { chair_id: chairId } : {}),
    })
    .eq("id", id)
    .select("id");
  if (error) return { error: agendaError(error) };
  if (!data.length) return { error: "Sem permissão para remarcar esta consulta." };

  revalidatePath(AGENDA_PATH);
  return { id };
}

export async function setAppointmentStatus(input: z.input<typeof statusSchema>): Promise<Result> {
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { error: "Status inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .update({
      status: parsed.data.status,
      ...(parsed.data.status === "canceled" ? { cancel_reason: parsed.data.cancelReason ?? null, cancel_note: parsed.data.cancelNote || null } : {}),
    })
    .eq("id", parsed.data.id)
    .select("id, patient_id");
  if (error) return { error: agendaError(error) };
  if (!data.length) return { error: "Sem permissão para alterar esta consulta." };

  revalidatePath(AGENDA_PATH);
  revalidatePath(`/pacientes/${data[0]!.patient_id}/agendamentos`);
  return { id: parsed.data.id };
}

export async function createBlock(input: z.input<typeof blockSchema>): Promise<Result> {
  const parsed = blockSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const ctx = await activeContext();
  if (!ctx) return { error: "Sessão expirada. Entre novamente." };

  const { professionalId, date, allDay, startTime, endTime, reason } = parsed.data;
  const startsAt = zonedToUtc(date, allDay ? "00:00" : startTime);
  const endsAt = allDay ? zonedToUtc(addDays(date, 1), "00:00") : zonedToUtc(date, endTime);

  const { error } = await ctx.supabase.from("schedule_blocks").insert({
    clinic_id: ctx.clinicId,
    unit_id: ctx.unitId,
    professional_id: professionalId,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    reason,
    created_by: ctx.session.user.id,
  });
  if (error) {
    return {
      error:
        error.code === "42501"
          ? "Você só pode bloquear a sua própria agenda."
          : "Não foi possível bloquear o horário.",
    };
  }
  revalidatePath(AGENDA_PATH);
  return {};
}

export async function deleteBlock(id: string): Promise<Result> {
  if (!z.uuid().safeParse(id).success) return { error: "Bloqueio inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("schedule_blocks").delete().eq("id", id).select("id");
  if (error || !data.length) return { error: "Não foi possível remover o bloqueio." };
  revalidatePath(AGENDA_PATH);
  return {};
}

export type PatientOption = { id: string; name: string; detail: string | null };

/** Busca rápida de pacientes ativos para marcar consulta. */
export async function findPatients(query: string): Promise<PatientOption[]> {
  const q = z.string().trim().max(100).catch("").parse(query);
  if (q.length < 2) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("search_patients", { _query: q, _status: "active", _limit: 8 });
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.full_name,
    detail: p.whatsapp ?? p.phone ?? null,
  }));
}

const quickPatientSchema = z.object({
  fullName: z.string().trim().min(3, "Informe o nome completo.").max(160),
  phone: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((d) => d === "" || /^[1-9]{2}9?\d{8}$/.test(d), "Telefone inválido. Use DDD + número.")
    .transform((d) => d || null),
});

/** Cadastro mínimo (nome e telefone) direto da agenda. O resto se completa na ficha. */
export async function quickCreatePatient(input: z.input<typeof quickPatientSchema>): Promise<Result & { option?: PatientOption }> {
  const parsed = quickPatientSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const ctx = await activeContext();
  if (!ctx) return { error: "Sessão expirada. Entre novamente." };

  const { data, error } = await ctx.supabase
    .from("patients")
    .insert({
      clinic_id: ctx.clinicId,
      full_name: parsed.data.fullName,
      phone: parsed.data.phone,
      whatsapp: parsed.data.phone,
    })
    .select("id, full_name, phone")
    .single();
  if (error) return { error: "Não foi possível cadastrar o paciente." };

  revalidatePath("/pacientes");
  return { id: data.id, option: { id: data.id, name: data.full_name, detail: data.phone } };
}

// Alerta de retorno ---------------------------------------------------------------------------

const returnSchema = z.object({
  patientId: z.uuid(),
  months: z.number().int().min(1).max(60),
  reason: z.string().trim().min(2).max(160),
  professionalId: z.uuid().nullable(),
  procedureId: z.uuid().nullable(),
  sourceAppointmentId: z.uuid().nullable(),
});

export async function createReturn(input: z.input<typeof returnSchema>): Promise<Result> {
  const parsed = returnSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados do retorno inválidos." };
  const ctx = await activeContext();
  if (!ctx) return { error: "Sessão expirada." };
  const d = parsed.data;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const { error } = await ctx.supabase.from("patient_returns").insert({
    clinic_id: ctx.clinicId,
    patient_id: d.patientId,
    professional_id: d.professionalId,
    procedure_id: d.procedureId,
    reason: d.reason,
    due_date: addMonths(today, d.months),
    source_appointment_id: d.sourceAppointmentId,
    created_by: ctx.session.user.id,
  });
  if (error) return { error: agendaError(error) };
  revalidatePath("/agenda/retornos");
  return {};
}

export async function setReturnStatus(returnId: string, status: "dismissed" | "done"): Promise<Result> {
  if (!z.uuid().safeParse(returnId).success) return { error: "Retorno inválido." };
  const supabase = await createClient();
  const { error } = await supabase.from("patient_returns").update({ status }).eq("id", returnId);
  if (error) return { error: agendaError(error) };
  revalidatePath("/agenda/retornos");
  return {};
}

// Lista de espera -----------------------------------------------------------------------------

const waitSchema = z.object({
  patientId: z.uuid(),
  professionalId: z.uuid().nullable(),
  period: z.enum(["any", "morning", "afternoon", "evening"]),
  notes: z.string().trim().max(300).optional(),
});

export async function addToWaitlist(input: z.input<typeof waitSchema>): Promise<Result> {
  const parsed = waitSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos." };
  const ctx = await activeContext();
  if (!ctx) return { error: "Sessão expirada." };
  const { error } = await ctx.supabase.from("waitlist").insert({
    clinic_id: ctx.clinicId,
    unit_id: ctx.unitId,
    patient_id: parsed.data.patientId,
    professional_id: parsed.data.professionalId,
    period: parsed.data.period,
    notes: parsed.data.notes || null,
    created_by: ctx.session.user.id,
  });
  if (error) return { error: agendaError(error) };
  revalidatePath("/agenda/espera");
  return {};
}

export async function removeFromWaitlist(entryId: string): Promise<Result> {
  if (!z.uuid().safeParse(entryId).success) return { error: "Inválido." };
  const supabase = await createClient();
  const { error } = await supabase.from("waitlist").update({ status: "removed" }).eq("id", entryId);
  if (error) return { error: agendaError(error) };
  revalidatePath("/agenda/espera");
  return {};
}

/** Encaixa alguém da lista de espera no horário de uma consulta desmarcada. */
export async function fillFromWaitlist(entryId: string, canceledAppointmentId: string): Promise<Result> {
  if (!z.uuid().safeParse(entryId).success || !z.uuid().safeParse(canceledAppointmentId).success) return { error: "Inválido." };
  const ctx = await activeContext();
  if (!ctx) return { error: "Sessão expirada." };
  const [{ data: entry }, { data: slot }] = await Promise.all([
    ctx.supabase.from("waitlist").select("id, patient_id, status").eq("id", entryId).maybeSingle(),
    ctx.supabase.from("appointments").select("unit_id, professional_id, chair_id, starts_at, ends_at, procedure_id, type").eq("id", canceledAppointmentId).maybeSingle(),
  ]);
  if (!entry || entry.status !== "waiting" || !slot) return { error: "Não foi possível encaixar." };
  const { data, error } = await ctx.supabase
    .from("appointments")
    .insert({
      clinic_id: ctx.clinicId,
      unit_id: slot.unit_id,
      patient_id: entry.patient_id,
      professional_id: slot.professional_id,
      chair_id: slot.chair_id,
      starts_at: slot.starts_at,
      ends_at: slot.ends_at,
      created_by: ctx.session.user.id,
    })
    .select("id")
    .single();
  if (error) return { error: agendaError(error) };
  await ctx.supabase.from("waitlist").update({ status: "scheduled", appointment_id: data.id }).eq("id", entryId);
  revalidatePath(AGENDA_PATH);
  revalidatePath("/agenda/espera");
  return { id: data.id };
}

/** Quem da lista de espera cabe no horário de uma consulta (para encaixe após desmarcação). */
export async function findWaitlistMatches(appointmentId: string): Promise<{ id: string; patientName: string; notes: string | null }[]> {
  if (!z.uuid().safeParse(appointmentId).success) return [];
  const supabase = await createClient();
  const [{ data: appt }, { data: entries }] = await Promise.all([
    supabase.from("appointments").select("unit_id, professional_id, starts_at").eq("id", appointmentId).maybeSingle(),
    supabase.from("waitlist").select("id, unit_id, professional_id, period, notes, patients(full_name)").eq("status", "waiting").order("created_at"),
  ]);
  if (!appt) return [];
  const slot = { professionalId: appt.professional_id, unitId: appt.unit_id, startMin: utcToZoned(appt.starts_at).minutes };
  return (entries ?? [])
    .filter((e) => fitsWaitlist({ professionalId: e.professional_id, unitId: e.unit_id, period: e.period }, slot))
    .map((e) => ({ id: e.id, patientName: e.patients?.full_name ?? "", notes: e.notes }));
}
