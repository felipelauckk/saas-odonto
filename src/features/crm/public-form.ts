import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import { publicLeadSchema } from "./schemas";

/** Clínica do formulário público (só o nome sai para a página). */
export async function loadLeadForm(token: string) {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("clinics").select("id, name").eq("lead_form_token", token).maybeSingle();
  return data;
}

/**
 * Grava o lead vindo do site. Robôs (campo-armadilha preenchido ou envio em
 * menos de 3 segundos) e repetições do mesmo telefone em 10 minutos recebem
 * "sucesso" sem gravar nada.
 */
export async function submitPublicLeadCore(input: Record<string, unknown>, now = Date.now()): Promise<{ error?: string; fieldErrors?: Record<string, string[] | undefined> }> {
  const parsed = publicLeadSchema.safeParse(input);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    if (flat.website) return {};
    return { error: "Confira os campos.", fieldErrors: flat };
  }
  const d = parsed.data;
  if (now - d.startedAt < 3000) return {};

  const clinic = await loadLeadForm(d.token);
  if (!clinic) return { error: "Formulário indisponível." };
  const admin = createAdminClient();

  const since = new Date(now - 10 * 60_000).toISOString();
  const { count } = await admin.from("leads").select("id", { count: "exact", head: true }).eq("clinic_id", clinic.id).eq("phone", d.phone!).gte("created_at", since);
  if (count) return {};

  const key = d.source === "passante" ? "placa" : d.source;
  const [{ data: stage }, { data: sources }, { data: campaign }] = await Promise.all([
    admin.from("crm_stages").select("id").eq("clinic_id", clinic.id).eq("auto_key", "new").single(),
    admin.from("patient_sources").select("id, key").eq("clinic_id", clinic.id).in("key", [key, "site"]),
    d.campaignId ? admin.from("crm_campaigns").select("id").eq("clinic_id", clinic.id).eq("id", d.campaignId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!stage) return { error: "Formulário indisponível." };

  const { error } = await admin.from("leads").insert({
    clinic_id: clinic.id,
    name: d.name,
    phone: d.phone,
    source_id: (sources ?? []).find((s) => s.key === key)?.id ?? (sources ?? []).find((s) => s.key === "site")?.id ?? null,
    campaign_id: campaign?.id ?? null,
    interest: d.interest,
    notes: d.message,
    stage_id: stage.id,
    from_public_form: true,
  });
  if (error) return { error: "Não foi possível enviar agora. Tente novamente mais tarde." };
  return {};
}
