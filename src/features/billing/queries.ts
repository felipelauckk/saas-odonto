import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function getBillingOverview() {
  const supabase = await createClient();
  const { data: clinicId } = await supabase.rpc("current_clinic_id");
  if (!clinicId) return null;
  const [{ data: clinic }, { data: plans }, { data: accessState }, { count: units }, { count: professionals }] = await Promise.all([
    supabase
      .from("clinics")
      .select("id, name, document_cnpj_cpf, subscription_status, trial_ends_at, past_due_since, plan_id, asaas_subscription_id, plans(name, price_cents)")
      .eq("id", clinicId)
      .single(),
    supabase.from("plans").select("id, name, price_cents, max_units, max_professionals, features").eq("active", true).order("price_cents"),
    supabase.rpc("clinic_access_state", { _clinic_id: clinicId }),
    supabase.from("units").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("professionals").select("id", { count: "exact", head: true }).eq("active", true),
  ]);
  if (!clinic) return null;
  return { clinic, plans: plans ?? [], accessState: accessState ?? "ok", usage: { units: units ?? 0, professionals: professionals ?? 0 } };
}
