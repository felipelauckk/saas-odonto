"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionContext } from "@/features/tenancy/queries";
import { subscriptionErrorMessage } from "@/lib/db-errors";
import { firstName, toWhatsAppNumber } from "@/lib/messaging/render";
import { getSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

import { issuePortalToken, PORTAL_DAYS } from "./portal";

type Result = { error?: string };

const settingsSchema = z.object({
  enabled: z.boolean(),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9](-?[a-z0-9])*$/, "Use letras minúsculas, números e hífen.").min(3, "Pelo menos 3 caracteres.").max(60),
  intro: z.string().trim().max(500),
  professionalIds: z.array(z.uuid()).max(100),
  procedureIds: z.array(z.uuid()).max(100),
  defaultDurationMin: z.number().int().min(10).max(240),
  minNoticeHours: z.number().int().min(0).max(168),
  maxDaysAhead: z.number().int().min(1).max(180),
});

export async function saveBookingSettings(input: z.input<typeof settingsSchema>): Promise<Result> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os campos." };
  const session = await getSessionContext();
  if (!session?.clinic || (session.clinic.role !== "owner" && session.clinic.role !== "manager")) return { error: "Sem permissão." };
  const supabase = await createClient();
  const d = parsed.data;
  const { error } = await supabase
    .from("online_booking_settings")
    .update({
      enabled: d.enabled,
      slug: d.slug,
      intro: d.intro || null,
      professional_ids: d.professionalIds,
      procedure_ids: d.procedureIds,
      default_duration_min: d.defaultDurationMin,
      min_notice_hours: d.minNoticeHours,
      max_days_ahead: d.maxDaysAhead,
    })
    .eq("clinic_id", session.clinic.id);
  if (error) return { error: error.code === "23505" ? "Esse endereço já está em uso. Escolha outro." : (subscriptionErrorMessage(error) ?? "Não foi possível salvar.") };
  revalidatePath("/configuracoes/agendamento-online");
  return {};
}

/** Gera o link do portal do paciente e a mensagem pronta para o WhatsApp. */
export async function createPortalLink(patientId: string): Promise<Result & { url?: string; whatsapp?: string | null }> {
  if (!z.uuid().safeParse(patientId).success) return { error: "Paciente inválido." };
  const session = await getSessionContext();
  if (!session?.clinic) return { error: "Sessão expirada." };
  const supabase = await createClient();
  const { data: patient } = await supabase.from("patients").select("full_name, whatsapp, phone").eq("id", patientId).maybeSingle();
  if (!patient) return { error: "Paciente não encontrado." };
  const { token, hash, expiresAt } = await issuePortalToken();
  const { error } = await supabase.from("portal_links").insert({ clinic_id: session.clinic.id, patient_id: patientId, token_hash: hash, expires_at: expiresAt, created_by: session.user.id });
  if (error) return { error: error.code === "42501" ? "Só a recepção e a gestão enviam o portal." : (subscriptionErrorMessage(error) ?? "Não foi possível gerar o link.") };
  const url = `${await getSiteUrl()}/portal/${token}`;
  const number = toWhatsAppNumber(patient.whatsapp ?? patient.phone);
  const text = `Olá, ${firstName(patient.full_name)}! Este é o seu acesso ao portal da ${session.clinic.name}: consultas, orçamentos, pagamentos e documentos. O link vale por ${PORTAL_DAYS} dias: ${url}`;
  return { url, whatsapp: number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : null };
}

/** Desativa todos os links de portal do paciente (ex.: celular perdido). */
export async function revokePortalLinks(patientId: string): Promise<Result> {
  if (!z.uuid().safeParse(patientId).success) return { error: "Paciente inválido." };
  const supabase = await createClient();
  const { error } = await supabase.from("portal_links").update({ revoked_at: new Date().toISOString() }).eq("patient_id", patientId).is("revoked_at", null);
  if (error) return { error: "Não foi possível desativar." };
  return {};
}
