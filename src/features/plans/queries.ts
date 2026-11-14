import "server-only";

import { createClient } from "@/lib/supabase/server";

import type { PlanStatus } from "./labels";

const PLAN_LIST_SELECT =
  "id, status, total_cents, discount_cents, created_at, approved_at, patient_id, patients(full_name), professionals(name, color)";

export async function listPlans({ status }: { status: PlanStatus | "open" | null }) {
  const supabase = await createClient();
  let query = supabase.from("treatment_plans").select(PLAN_LIST_SELECT).order("created_at", { ascending: false }).limit(200);
  if (status === "open") query = query.in("status", ["draft", "presented"]);
  else if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function listPatientPlans(patientId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("treatment_plans")
    .select(PLAN_LIST_SELECT)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getPlan(id: string) {
  const supabase = await createClient();
  const [{ data: plan, error }, { data: items, error: itemsError }, { data: receivables }] = await Promise.all([
    supabase
      .from("treatment_plans")
      .select(
        "*, patients(id, full_name, cpf, phone, whatsapp, archived_at), professionals(id, name, cro), payment_methods(name), units(name)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("treatment_items").select("*").eq("plan_id", id).order("position").order("created_at"),
    supabase
      .from("receivables")
      .select("id, amount_cents, due_date, installment_number, installment_total, status")
      .eq("plan_id", id)
      .order("installment_number"),
  ]);
  if (error) throw error;
  if (itemsError) throw itemsError;
  if (!plan) return null;
  return { plan, items, receivables: receivables ?? [] };
}

export type PlanDetail = NonNullable<Awaited<ReturnType<typeof getPlan>>>;

/** Dados da clínica para o cabeçalho do PDF (logo em bytes). */
export async function getClinicLetterhead() {
  const supabase = await createClient();
  const { data: clinicId } = await supabase.rpc("current_clinic_id");
  if (!clinicId) return null;
  const { data: clinic } = await supabase
    .from("clinics")
    .select("name, legal_name, document_cnpj_cpf, phone, email, logo_url")
    .eq("id", clinicId)
    .single();
  if (!clinic) return null;
  let logo: { data: Buffer; format: "png" | "jpg" } | null = null;
  if (clinic.logo_url && !clinic.logo_url.endsWith(".webp")) {
    const { data: file } = await supabase.storage.from("clinic").download(clinic.logo_url);
    if (file) logo = { data: Buffer.from(await file.arrayBuffer()), format: clinic.logo_url.endsWith(".png") ? "png" : "jpg" };
  }
  return { ...clinic, logo };
}
