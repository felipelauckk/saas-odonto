import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

import { parseAnswers, parseQuestions } from "./anamnesis";

/** O que o usuário pode fazer no prontuário e com quais profissionais assina. */
export const getClinicalAccess = cache(async () => {
  const supabase = await createClient();
  const [read, write, own] = await Promise.all([
    supabase.rpc("can_read_clinical"),
    supabase.rpc("can_write_clinical"),
    supabase.rpc("current_professional_ids"),
  ]);
  const ownIds = (own.data ?? []) as string[];
  const { data: professionals } = ownIds.length
    ? await supabase.from("professionals").select("id, name").in("id", ownIds).eq("active", true).order("name")
    : { data: [] };
  return { canRead: read.data === true, canWrite: write.data === true, professionals: professionals ?? [] };
});

export const getPatientAlerts = cache(async (patientId: string) => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("patient_alerts", { _patient_id: patientId });
  return data ?? [];
});

/** Nomes de quem registrou (perfis de colegas da clínica ativa). */
async function namesOf(userIds: (string | null)[]) {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  if (!ids.length) return new Map<string, string>();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name").in("id", ids);
  return new Map((data ?? []).map((p) => [p.id, p.full_name ?? "Usuário"]));
}

export async function getAnamnesis(patientId: string) {
  const supabase = await createClient();
  const [versionsRes, templateRes] = await Promise.all([
    supabase
      .from("anamneses")
      .select("id, answers, filled_by, signed_at, created_at, template_id")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false }),
    supabase
      .from("anamnesis_templates")
      .select("id, name, questions")
      .eq("active", true)
      .order("is_default", { ascending: false })
      .order("created_at")
      .limit(1)
      .maybeSingle(),
  ]);
  if (versionsRes.error) throw versionsRes.error;
  const names = await namesOf(versionsRes.data.map((v) => v.filled_by));
  return {
    versions: versionsRes.data.map((v) => ({
      id: v.id,
      createdAt: v.created_at,
      filledBy: v.filled_by ? (names.get(v.filled_by) ?? "Usuário") : v.signed_at ? "preenchida e assinada pelo paciente" : null,
      answers: parseAnswers(v.answers),
    })),
    template: templateRes.data
      ? { id: templateRes.data.id, name: templateRes.data.name, questions: parseQuestions(templateRes.data.questions) }
      : null,
  };
}

export async function getToothRecords(patientId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tooth_records")
    .select("id, tooth, faces, condition, notes, recorded_by, created_at")
    .eq("patient_id", patientId)
    .order("created_at");
  if (error) throw error;
  const names = await namesOf(data.map((r) => r.recorded_by));
  return data.map((r) => ({ ...r, recordedBy: r.recorded_by ? (names.get(r.recorded_by) ?? "Usuário") : null }));
}

export async function listClinicalNotes(patientId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clinical_notes")
    .select("id, body, created_at, complements_note_id, professionals(name, color)")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

/** Arquivos com links assinados de curta duração (10 minutos). */
export async function listPatientFiles(patientId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patient_files")
    .select("id, storage_path, kind, description, mime_type, size_bytes, created_at")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!data.length) return [];

  const { data: signed } = await supabase.storage.from("clinic").createSignedUrls(
    data.map((f) => f.storage_path),
    60 * 10,
  );
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  return data.map((f) => ({ ...f, url: urlByPath.get(f.storage_path) ?? null }));
}

export async function getDefaultTemplate() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("anamnesis_templates")
    .select("id, name, questions")
    .eq("active", true)
    .order("is_default", { ascending: false })
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return data ? { id: data.id, name: data.name, questions: parseQuestions(data.questions) } : null;
}
