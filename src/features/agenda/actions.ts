"use server";

import type { PostgrestError } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { addDays, zonedToUtc } from "@/lib/timezone";
import { getSessionContext } from "@/features/tenancy/queries";

import { appointmentSchema, blockSchema, moveAppointmentSchema, statusSchema } from "./schemas";

type Result = { error?: string; id?: string };

const AGENDA_PATH = "/agenda";

/** Mensagem clara para conflitos e bloqueios vindos do banco. */
function agendaError(error: PostgrestError): string {
  if (error.code === "23P01") {
    return error.message.includes("chair")
      ? "A cadeira já está ocupada nesse horário."
      : "O profissional já tem consulta nesse horário.";
  }
  if (error.code === "OB001") return error.message.replace(/^Horário bloqueado: /, "Horário bloqueado: ");
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

export async function saveAppointment(input: z.input<typeof appointmentSchema>): Promise<Result> {
  const parsed = appointmentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const ctx = await activeContext();
  if (!ctx) return { error: "Sessão expirada. Entre novamente." };

  const { id, patientId, professionalId, chairId, procedureId, date, time, durationMin, type, notes } = parsed.data;
  const row = {
    professional_id: professionalId,
    chair_id: chairId,
    procedure_id: procedureId,
    type,
    notes,
    ...interval(date, time, durationMin),
  };

  const { data, error } = id
    ? await ctx.supabase.from("appointments").update(row).eq("id", id).select("id")
    : await ctx.supabase
        .from("appointments")
        .insert({
          ...row,
          clinic_id: ctx.clinicId,
          unit_id: ctx.unitId,
          patient_id: patientId,
          created_by: ctx.session.user.id,
        })
        .select("id");

  if (error) return { error: agendaError(error) };
  if (!data.length) return { error: "Consulta não encontrada ou sem permissão." };
  revalidatePath(AGENDA_PATH);
  return { id: data[0]!.id };
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
    .update({ status: parsed.data.status })
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
