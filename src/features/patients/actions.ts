"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { formValues, type ActionState } from "@/lib/action-state";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/features/tenancy/queries";

import { patientSchema, type PatientInput } from "./schemas";

function toRow(data: PatientInput) {
  const { cep, street, number, complement, district, city, state } = data;
  const hasAddress = [cep, street, number, complement, district, city, state].some(Boolean);
  return {
    full_name: data.fullName,
    cpf: data.cpf,
    birth_date: data.birthDate,
    gender: data.gender,
    phone: data.phone,
    whatsapp: data.whatsapp,
    email: data.email,
    address: hasAddress ? { cep, street, number, complement, district, city, state } : null,
    source: data.source,
    notes: data.notes,
    guardian_name: data.guardianName,
    guardian_cpf: data.guardianCpf,
  };
}

async function duplicateCpfState(cpf: string, values: Record<string, string>): Promise<ActionState> {
  const supabase = await createClient();
  const { data } = await supabase.from("patients").select("id, full_name").eq("cpf", cpf).maybeSingle();
  return {
    status: "error",
    message: data
      ? `Já existe um paciente com este CPF: ${data.full_name}.`
      : "Já existe um paciente com este CPF.",
    fieldErrors: { cpf: ["CPF já cadastrado."] },
    values: data ? { ...values, duplicateId: data.id } : values,
  };
}

function invalid(error: z.ZodError, values: Record<string, string>): ActionState {
  return {
    status: "error",
    message: "Confira os campos destacados.",
    fieldErrors: z.flattenError(error).fieldErrors,
    values,
  };
}

export async function createPatient(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = patientSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);

  const session = await getSessionContext();
  if (!session?.clinic) return { status: "error", message: "Sessão expirada. Entre novamente.", values };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patients")
    .insert({
      ...toRow(parsed.data),
      clinic_id: session.clinic.id,
      ...(parsed.data.consentLgpd ? { consent_lgpd_at: new Date().toISOString(), consent_lgpd_by: session.user.id } : {}),
    })
    .select("id")
    .single();

  if (error?.code === "23505" && parsed.data.cpf) return duplicateCpfState(parsed.data.cpf, values);
  if (error) return { status: "error", message: "Não foi possível salvar o paciente. Tente novamente.", values };

  revalidatePath("/pacientes");
  redirect(`/pacientes/${data.id}`);
}

export async function updatePatient(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = patientSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error, values);
  if (!parsed.data.id) return { status: "error", message: "Paciente não informado.", values };

  const session = await getSessionContext();
  if (!session?.clinic) return { status: "error", message: "Sessão expirada. Entre novamente.", values };

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("patients")
    .select("consent_lgpd_at")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!current) return { status: "error", message: "Paciente não encontrado.", values };

  // O consentimento só é registrado uma vez (data e quem registrou).
  const consent =
    parsed.data.consentLgpd && !current.consent_lgpd_at
      ? { consent_lgpd_at: new Date().toISOString(), consent_lgpd_by: session.user.id }
      : {};

  const { data, error } = await supabase
    .from("patients")
    .update({ ...toRow(parsed.data), ...consent })
    .eq("id", parsed.data.id)
    .select("id");

  if (error?.code === "23505" && parsed.data.cpf) return duplicateCpfState(parsed.data.cpf, values);
  if (error || !data.length) return { status: "error", message: "Não foi possível salvar o paciente.", values };

  revalidatePath("/pacientes");
  revalidatePath(`/pacientes/${parsed.data.id}`);
  redirect(`/pacientes/${parsed.data.id}`);
}

export async function setPatientArchived(id: string, archived: boolean): Promise<{ error?: string }> {
  if (!z.uuid().safeParse(id).success) return { error: "Paciente inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patients")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id");
  if (error || !data.length) return { error: "Não foi possível alterar o paciente." };

  revalidatePath("/pacientes");
  revalidatePath(`/pacientes/${id}`);
  return {};
}
