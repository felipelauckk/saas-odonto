import "server-only";

import { createClient } from "@/lib/supabase/server";

export const AUDIT_TABLE_LABELS: Record<string, string> = {
  patients: "Dados do paciente",
  anamneses: "Anamnese",
  tooth_records: "Odontograma",
  clinical_notes: "Evolução",
  patient_files: "Arquivo clínico",
  treatment_plans: "Orçamento",
  treatment_items: "Item de orçamento",
  receivables: "Financeiro",
  cash_movements: "Caixa",
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  view: "Abriu",
  insert: "Criou",
  update: "Alterou",
  delete: "Apagou",
  export: "Exportou",
};

export async function listAuditLog({ action }: { action: string | null }) {
  const supabase = await createClient();
  let query = supabase.from("audit_log").select("id, user_id, action, table_name, record_id, patient_id, at").order("at", { ascending: false }).limit(200);
  if (action) query = query.eq("action", action);
  const { data, error } = await query;
  if (error) throw error;

  const userIds = [...new Set(data.map((r) => r.user_id).filter((v): v is string => Boolean(v)))];
  const patientIds = [...new Set(data.map((r) => r.patient_id).filter((v): v is string => Boolean(v)))];
  const [{ data: profiles }, { data: patients }] = await Promise.all([
    userIds.length ? supabase.from("profiles").select("id, full_name").in("id", userIds) : Promise.resolve({ data: [] }),
    patientIds.length ? supabase.from("patients").select("id, full_name").in("id", patientIds) : Promise.resolve({ data: [] }),
  ]);
  const userName = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const patientName = new Map((patients ?? []).map((p) => [p.id, p.full_name]));
  return data.map((r) => ({
    ...r,
    userName: r.user_id ? (userName.get(r.user_id) ?? "Usuário") : "Sistema",
    patientName: r.patient_id ? (patientName.get(r.patient_id) ?? null) : null,
  }));
}
