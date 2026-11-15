import "server-only";

import { createClient } from "@/lib/supabase/server";

import { CLINICAL_KINDS } from "./labels";

export async function listPatientDocuments(patientId: string) {
  const supabase = await createClient();
  const [{ data: docs, error }, { data: requests }] = await Promise.all([
    supabase
      .from("patient_documents")
      .select("id, kind, title, status, issued_at, pdf_sha256, canceled_at, professionals(name)")
      .eq("patient_id", patientId)
      .order("issued_at", { ascending: false }),
    supabase
      .from("signature_requests")
      .select("id, purpose, document_id, status, expires_at, signed_at, signer_name, signed_sha256, anamnesis_id, created_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false }),
  ]);
  if (error) throw error;
  return { documents: docs, requests: requests ?? [] };
}

/** Modelos que o usuário pode usar (clínicos só para quem atende). */
export async function listUsableTemplates(canWriteClinical: boolean) {
  const supabase = await createClient();
  const { data } = await supabase.from("document_templates").select("id, kind, name, procedure_id").eq("active", true).order("kind").order("name");
  return (data ?? []).filter((t) => canWriteClinical || !CLINICAL_KINDS.includes(t.kind));
}

export async function listMedications(includeInactive = false) {
  const supabase = await createClient();
  let query = supabase.from("medications").select("id, name, presentation, default_dosage, default_quantity, special_control, active").order("name");
  if (!includeInactive) query = query.eq("active", true);
  const { data } = await query;
  return data ?? [];
}

export async function listDocumentTemplates() {
  const supabase = await createClient();
  const { data } = await supabase.from("document_templates").select("id, kind, name, body, procedure_id, active").order("kind").order("name");
  return data ?? [];
}
