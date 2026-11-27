import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Leituras das telas de Configurações. Todas usam o cliente do usuário,
 * então a RLS limita à clínica ativa.
 */

export async function getClinic() {
  const supabase = await createClient();
  const { data: clinicId } = await supabase.rpc("current_clinic_id");
  if (!clinicId) return null;
  const { data, error } = await supabase
    .from("clinics")
    .select("id, name, legal_name, document_cnpj_cpf, phone, email, logo_url, google_review_url, review_request_delay_hours")
    .eq("id", clinicId)
    .single();
  if (error) throw error;

  let logoSignedUrl: string | null = null;
  if (data.logo_url) {
    const { data: signed } = await supabase.storage.from("clinic").createSignedUrl(data.logo_url, 60 * 10);
    logoSignedUrl = signed?.signedUrl ?? null;
  }
  return { ...data, logoSignedUrl };
}

export async function listUnits() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("units")
    .select("id, name, phone, address, active")
    .order("active", { ascending: false })
    .order("created_at");
  if (error) throw error;
  return data;
}

export async function listChairs() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chairs")
    .select("id, name, active, unit_id")
    .order("active", { ascending: false })
    .order("name");
  if (error) throw error;
  return data;
}

export async function listProfessionals() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("professionals")
    .select("id, name, cro, specialty, color, active, member_id")
    .order("active", { ascending: false })
    .order("name");
  if (error) throw error;
  return data;
}

export async function getProfessional(id: string) {
  const supabase = await createClient();
  const [{ data: professional, error }, { data: schedules, error: schedulesError }] = await Promise.all([
    supabase
      .from("professionals")
      .select("id, name, cro, specialty, color, active, member_id")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("professional_schedules")
      .select("id, unit_id, weekday, start_time, end_time")
      .eq("professional_id", id)
      .order("weekday")
      .order("start_time"),
  ]);
  if (error) throw error;
  if (schedulesError) throw schedulesError;
  if (!professional) return null;
  return { professional, schedules: schedules ?? [] };
}

/**
 * Membros ativos que podem ser ligados a um profissional (dentistas e gestores),
 * com o nome para exibir.
 */
export async function listLinkableMembers() {
  const supabase = await createClient();
  const { data: clinicId } = await supabase.rpc("current_clinic_id");
  if (!clinicId) return [];
  const { data: members, error } = await supabase
    .from("clinic_members")
    .select("id, user_id, role")
    .eq("clinic_id", clinicId)
    .eq("active", true)
    .neq("role", "receptionist");
  if (error) throw error;
  if (!members.length) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", members.map((m) => m.user_id));
  const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  // Quem não tem nome no perfil aparece pelo e-mail.
  const missing = members.filter((m) => !names.get(m.user_id));
  if (missing.length) {
    const admin = createAdminClient();
    const users = await Promise.all(missing.map((m) => admin.auth.admin.getUserById(m.user_id)));
    for (const { data } of users) if (data.user) names.set(data.user.id, data.user.email ?? null);
  }

  return members.map((m) => ({ id: m.id, name: names.get(m.user_id) ?? "Sem nome" }));
}

export async function listProcedures() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("procedures")
    .select("id, name, code, category, price_cents, duration_min, return_months, applies_to_tooth, active")
    .order("category", { nullsFirst: false })
    .order("name");
  if (error) throw error;
  return data;
}

export async function listPaymentMethods() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment_methods")
    .select("id, name, fee_percent, days_to_receive, active")
    .order("active", { ascending: false })
    .order("created_at");
  if (error) throw error;
  return data;
}

/** Contagens para os cartões da página inicial de Configurações. */
export async function getSettingsSummary() {
  const supabase = await createClient();
  const count = async (table: "units" | "chairs" | "professionals" | "procedures" | "payment_methods") => {
    const { count: total } = await supabase.from(table).select("id", { count: "exact", head: true }).eq("active", true);
    return total ?? 0;
  };
  const [units, chairs, professionals, procedures, paymentMethods, unpriced] = await Promise.all([
    count("units"),
    count("chairs"),
    count("professionals"),
    count("procedures"),
    count("payment_methods"),
    supabase
      .from("procedures")
      .select("id", { count: "exact", head: true })
      .eq("active", true)
      .eq("price_cents", 0)
      .then((r) => r.count ?? 0),
  ]);
  return { units, chairs, professionals, procedures, paymentMethods, unpriced };
}

export type IntegrationStatus = { name: string; detail: string; status: string; tone: "success" | "warning" | "neutral"; href: string };

/** Situação de cada integração, para o resumo de Configurações. */
export async function getIntegrations(clinicId: string): Promise<IntegrationStatus[]> {
  const supabase = await createClient();
  const [billing, fiscal, ai] = await Promise.all([
    createAdminClient().from("clinic_billing").select("connected_at").eq("clinic_id", clinicId).maybeSingle(),
    supabase.from("clinic_fiscal_settings").select("enabled").eq("clinic_id", clinicId).maybeSingle(),
    supabase.from("clinic_ai_settings").select("assistant_enabled, followup_enabled, insights_enabled, voice_enabled").eq("clinic_id", clinicId).maybeSingle(),
  ]);
  const env = process.env;
  const whatsappReal = env.WHATSAPP_PROVIDER === "meta" && Boolean(env.WHATSAPP_API_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID);
  const aiOn = Boolean(ai.data && (ai.data.assistant_enabled || ai.data.followup_enabled || ai.data.insights_enabled || ai.data.voice_enabled));
  const aiKey = Boolean(env.ANTHROPIC_API_KEY);
  const list: IntegrationStatus[] = [
    {
      name: "WhatsApp",
      detail: whatsappReal ? "API oficial da Meta" : "Envio simulado: nada sai de verdade",
      status: whatsappReal ? "Conectado" : "Simulado",
      tone: whatsappReal ? "success" : "warning",
      href: "/configuracoes/mensagens",
    },
    {
      name: "Cobrança online (Asaas)",
      detail: "Pix, boleto e link de pagamento",
      status: billing.data?.connected_at ? "Conectado" : "Desligado",
      tone: billing.data?.connected_at ? "success" : "neutral",
      href: "/configuracoes/cobranca",
    },
    {
      name: "Nota fiscal (NFS-e)",
      detail: "Emissão a partir dos recebimentos",
      status: fiscal.data?.enabled ? "Ligada" : "Desligada",
      tone: fiscal.data?.enabled ? "success" : "neutral",
      href: "/configuracoes/nota-fiscal",
    },
  ];
  // Primeira versão sem IA: a linha só aparece com a chave configurada no servidor.
  if (aiKey) list.push({
      name: "Inteligência artificial",
      detail: "Assistente, follow-up e perguntas",
      status: aiOn ? "Ligada" : "Desligada",
      tone: aiOn ? "success" : "neutral",
      href: "/configuracoes/inteligencia-artificial",
    });
  return list;
}
