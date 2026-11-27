"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { formValues, type ActionState } from "@/lib/action-state";
import { subscriptionErrorMessage } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/features/tenancy/queries";

import { getPatient, getPatientSources, type Patient } from "./queries";
import type { PatientSourceOption } from "./sources";
import { patientSchema, type PatientInput } from "./schemas";

function toRow(data: PatientInput) {
  const { cep, street, number, complement, district, city, state } = data;
  const hasAddress = [cep, street, number, complement, district, city, state].some(Boolean);
  const [kind, refId] = data.referral && data.referral !== "none" ? data.referral.split(":") : [null, null];
  return {
    full_name: data.fullName,
    nickname: data.nickname,
    cpf: data.cpf,
    rg: data.rg,
    birth_date: data.birthDate,
    gender: data.gender,
    marital_status: data.maritalStatus,
    education: data.education,
    record_number: data.recordNumber,
    phone_country: data.phoneCountry,
    phone: data.phone,
    whatsapp: data.whatsapp,
    landline: data.landline,
    email: data.email,
    no_email: data.noEmail,
    instagram: data.instagram,
    facebook: data.facebook,
    preferred_contact: data.preferredContact,
    address: hasAddress ? { cep, street, number, complement, district, city, state } : null,
    guardian_name: data.guardianName,
    guardian_relationship: data.guardianRelationship,
    guardian_cpf: data.guardianCpf,
    guardian_rg: data.guardianRg,
    guardian_birth_date: data.guardianBirthDate,
    guardian_phone: data.guardianPhone,
    father_name: data.fatherName,
    mother_name: data.motherName,
    occupation: data.occupation,
    workplace: data.workplace,
    source_id: data.sourceId,
    referred_by_patient_id: kind === "patient" ? refId : null,
    referred_by_partner_id: kind === "partner" ? refId : null,
    notes: data.notes,
  };
}

/** Troca a lista de outros telefones do paciente. */
async function savePhones(supabase: Awaited<ReturnType<typeof createClient>>, clinicId: string, patientId: string, phones: PatientInput["otherPhones"]) {
  await supabase.from("patient_phones").delete().eq("patient_id", patientId);
  if (phones.length) {
    await supabase.from("patient_phones").insert(phones.map((p) => ({ clinic_id: clinicId, patient_id: patientId, label: p.label || null, number: p.number })));
  }
}

/** A clínica exige e-mail? (Configurações > Pacientes e captação) */
async function parseWithClinicRules(values: Record<string, string>, clinicId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("clinics").select("require_patient_email").eq("id", clinicId).maybeSingle();
  return patientSchema.safeParse({ ...values, requireEmail: data?.require_patient_email ?? false });
}

function recordNumberTaken(error: { code?: string; message?: string } | null) {
  return error?.code === "23505" && (error.message ?? "").includes("record_number");
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
  const session = await getSessionContext();
  if (!session?.clinic) return { status: "error", message: "Sessão expirada. Entre novamente.", values };
  const parsed = await parseWithClinicRules(values, session.clinic.id);
  if (!parsed.success) return invalid(parsed.error, values);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patients")
    .insert({
      ...toRow(parsed.data),
      clinic_id: session.clinic.id,
      ...(parsed.data.consentLgpd ? { consent_lgpd_at: new Date().toISOString(), consent_lgpd_by: session.user.id } : {}),
    })
    .select("id, full_name, whatsapp, phone")
    .single();

  if (recordNumberTaken(error)) return { status: "error", message: "Esse número de prontuário já é de outro paciente.", fieldErrors: { recordNumber: ["Número já usado."] }, values };
  if (error?.code === "23505" && parsed.data.cpf) return duplicateCpfState(parsed.data.cpf, values);
  if (error) return { status: "error", message: subscriptionErrorMessage(error) ?? "Não foi possível salvar o paciente. Tente novamente.", values };
  await savePhones(supabase, session.clinic.id, data.id, parsed.data.otherPhones);

  revalidatePath("/pacientes");
  // Cadastro aberto por cima de outra tela (ex.: Nova consulta): devolve o paciente e fica.
  if (formData.get("stay") === "1") {
    return { status: "success", message: "Paciente cadastrado.", values: { createdId: data.id, createdName: data.full_name, createdPhone: data.whatsapp ?? data.phone ?? "" } };
  }
  redirect(`/pacientes/${data.id}`);
}

export async function updatePatient(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const session = await getSessionContext();
  if (!session?.clinic) return { status: "error", message: "Sessão expirada. Entre novamente.", values };
  const parsed = await parseWithClinicRules(values, session.clinic.id);
  if (!parsed.success) return invalid(parsed.error, values);
  if (!parsed.data.id) return { status: "error", message: "Paciente não informado.", values };

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

  if (recordNumberTaken(error)) return { status: "error", message: "Esse número de prontuário já é de outro paciente.", fieldErrors: { recordNumber: ["Número já usado."] }, values };
  if (error?.code === "23505" && parsed.data.cpf) return duplicateCpfState(parsed.data.cpf, values);
  if (error || !data.length) return { status: "error", message: subscriptionErrorMessage(error) ?? "Não foi possível salvar o paciente.", values };
  await savePhones(supabase, session.clinic.id, parsed.data.id, parsed.data.otherPhones);

  revalidatePath("/pacientes");
  revalidatePath(`/pacientes/${parsed.data.id}`);
  // Editado num painel por cima de outra tela (ex.: Nova consulta): fica onde está.
  if (formData.get("stay") === "1") return { status: "success", message: "Cadastro atualizado." };
  redirect(`/pacientes/${parsed.data.id}`);
}

export type PatientFormOptions = {
  sources: PatientSourceOption[];
  partners: { id: string; name: string; active: boolean }[];
  clinicId: string;
  recordAuto: boolean;
  requireEmail: boolean;
};

/** O que o formulário de paciente precisa (origens, parceiros e regras da clínica). */
export async function loadPatientFormOptions(): Promise<PatientFormOptions | null> {
  const session = await getSessionContext();
  if (!session?.clinic) return null;
  const supabase = await createClient();
  const [sources, { data: partners }, { data: clinic }] = await Promise.all([
    getPatientSources(),
    supabase.from("referral_partners").select("id, name, active").order("name"),
    supabase.from("clinics").select("patient_record_auto, require_patient_email").eq("id", session.clinic.id).maybeSingle(),
  ]);
  return { sources, partners: partners ?? [], clinicId: session.clinic.id, recordAuto: clinic?.patient_record_auto ?? false, requireEmail: clinic?.require_patient_email ?? false };
}

const photoPathSchema = z.string().regex(/^[0-9a-f-]{36}\/patient-photos\/[0-9a-f-]{36}\/[A-Za-z0-9._-]+$/);

/** Grava (ou tira) a foto do paciente, já enviada ao Storage pelo navegador; apaga a anterior. */
export async function setPatientPhoto(patientId: string, path: string | null): Promise<{ error?: string; url?: string | null }> {
  if (!z.uuid().safeParse(patientId).success || (path !== null && !photoPathSchema.safeParse(path).success)) return { error: "Foto inválida." };
  if (path && !path.includes(`/patient-photos/${patientId}/`)) return { error: "Foto inválida." };
  const supabase = await createClient();
  const { data: current } = await supabase.from("patients").select("photo_path").eq("id", patientId).maybeSingle();
  if (!current) return { error: "Paciente não encontrado." };
  const { data, error } = await supabase.from("patients").update({ photo_path: path }).eq("id", patientId).select("id");
  if (error || !data.length) return { error: "Não foi possível salvar a foto." };
  if (current.photo_path && current.photo_path !== path) await supabase.storage.from("clinic").remove([current.photo_path]);
  revalidatePath(`/pacientes/${patientId}`);
  return { url: path ? await patientPhotoUrl(path) : null };
}

/** Endereço temporário (assinado) para mostrar a foto. */
export async function patientPhotoUrl(path: string | null): Promise<string | null> {
  if (!path || !photoPathSchema.safeParse(path).success) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage.from("clinic").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

export type PatientHistoryEntry = { at: string; action: string; userName: string; changes: Record<string, { from: unknown; to: unknown }> };

/** Histórico de edição do cadastro (quem, quando e o que mudou). */
export async function loadPatientHistory(patientId: string): Promise<PatientHistoryEntry[]> {
  if (!z.uuid().safeParse(patientId).success) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("patient_history", { _patient_id: patientId });
  return (data ?? []).map((h) => ({ at: h.at, action: h.action, userName: h.user_name, changes: (h.changes ?? {}) as PatientHistoryEntry["changes"] }));
}

/** Cadastro completo para editar num painel lateral (lido com a sessão do usuário). */
export async function loadPatientForEdit(id: string): Promise<Patient | null> {
  if (!z.uuid().safeParse(id).success) return null;
  return getPatient(id);
}

export async function setPatientArchived(id: string, archived: boolean): Promise<{ error?: string }> {
  if (!z.uuid().safeParse(id).success) return { error: "Paciente inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patients")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id");
  if (error || !data.length) return { error: subscriptionErrorMessage(error) ?? "Não foi possível alterar o paciente." };

  revalidatePath("/pacientes");
  // O cabeçalho (com o selo "Arquivado") fica no layout da ficha: recarrega o layout inteiro.
  revalidatePath(`/pacientes/${id}`, "layout");
  return {};
}
