import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import { requirePlatformAdmin } from "./guard";

/**
 * Dados do painel do superadmin. Usa a service role, mas só seleciona dados
 * da clínica e da assinatura — nunca tabelas de pacientes ou prontuário.
 */
export async function listClinicsForAdmin() {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  const [{ data: clinics }, { data: members }] = await Promise.all([
    admin
      .from("clinics")
      .select("id, name, subscription_status, trial_ends_at, past_due_since, created_at, plans(name, price_cents)")
      .order("created_at", { ascending: false }),
    admin.from("clinic_members").select("clinic_id").eq("active", true),
  ]);
  const count = new Map<string, number>();
  for (const m of members ?? []) count.set(m.clinic_id, (count.get(m.clinic_id) ?? 0) + 1);
  return (clinics ?? []).map((c) => ({ ...c, members: count.get(c.id) ?? 0 }));
}

export async function getClinicForAdmin(id: string) {
  await requirePlatformAdmin();
  const admin = createAdminClient();
  const [{ data: clinic }, { data: events }, { data: owners }] = await Promise.all([
    admin
      .from("clinics")
      .select("id, name, legal_name, document_cnpj_cpf, email, phone, subscription_status, trial_ends_at, past_due_since, canceled_at, plan_id, asaas_customer_id, asaas_subscription_id, created_at")
      .eq("id", id)
      .maybeSingle(),
    admin.from("billing_events").select("id, event, received_at").eq("clinic_id", id).order("received_at", { ascending: false }).limit(20),
    admin.from("clinic_members").select("user_id, role").eq("clinic_id", id).eq("role", "owner").eq("active", true),
  ]);
  if (!clinic) return null;
  const ownerEmails = await Promise.all((owners ?? []).map(async (o) => (await admin.auth.admin.getUserById(o.user_id)).data.user?.email ?? null));
  return { clinic, events: events ?? [], ownerEmails: ownerEmails.filter(Boolean) as string[] };
}

export async function listPlansForAdmin() {
  await requirePlatformAdmin();
  const { data } = await createAdminClient().from("plans").select("*").order("price_cents");
  return data ?? [];
}
