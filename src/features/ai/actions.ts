"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { normalizePhone } from "@/features/booking/slots";
import { getSessionContext } from "@/features/tenancy/queries";
import { isAiConfigured } from "@/lib/ai/claude";
import { isMessagingConfigured } from "@/lib/messaging";
import { createClient } from "@/lib/supabase/server";

import { handleInboundMessage, sendToConversation } from "./assistant";
import { askData, monthlySummary } from "./insights";
import { structureDictation, type DictationResult } from "./voice";

/** O microfone aparece só se o recurso estiver ligado na clínica. */
export async function voiceAvailable(): Promise<boolean> {
  const session = await getSessionContext();
  if (!session?.clinic || !isAiConfigured()) return false;
  const supabase = await createClient();
  const { data } = await supabase.from("clinic_ai_settings").select("voice_enabled").eq("clinic_id", session.clinic.id).maybeSingle();
  return Boolean(data?.voice_enabled);
}

const schema = z.object({
  kind: z.enum(["note", "plan", "anamnesis"]),
  text: z.string().trim().min(3, "Dite ou escreva alguma coisa.").max(8000),
  context: z.object({
    procedures: z.array(z.object({ id: z.string(), name: z.string().max(200) })).max(500).optional(),
    questions: z.array(z.object({ id: z.string(), label: z.string().max(300) })).max(80).optional(),
  }),
});

export async function structureDictationAction(input: z.input<typeof schema>): Promise<{ error: string } | DictationResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const session = await getSessionContext();
  if (!session?.clinic) return { error: "Sessão expirada." };
  const supabase = await createClient();
  const { data: canWrite } = await supabase.rpc("can_write_clinical");
  if (!canWrite) return { error: "Só quem atende usa o registro por voz." };
  try {
    return await structureDictation({ clinicId: session.clinic.id, userId: session.user.id, ...parsed.data });
  } catch {
    return { error: "A IA não respondeu agora. Tente de novo em instantes." };
  }
}

// Configuração (gestão) -------------------------------------------------------------------------

const settingsSchema = z.object({
  voiceEnabled: z.boolean(),
  assistantEnabled: z.boolean(),
  followupEnabled: z.boolean(),
  insightsEnabled: z.boolean(),
  monthlyLimitUsd: z.number().min(0).max(10000),
  assistantInfo: z.string().max(8000),
  whatsappPhoneNumberId: z.string().trim().max(40).regex(/^\d*$/, "Só números."),
  followupQueues: z.array(z.enum(["open_quotes", "no_shows", "first_visit_no_shows", "untreated", "overdue_returns", "birthdays", "overdue_payments"])).max(7),
  followupMinDays: z.number().int().min(1).max(90),
});

export async function saveAiSettings(input: z.input<typeof settingsSchema>): Promise<{ error?: string }> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os campos." };
  const session = await getSessionContext();
  if (!session?.clinic || (session.clinic.role !== "owner" && session.clinic.role !== "manager")) return { error: "Sem permissão." };
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("clinic_ai_settings")
    .update({
      voice_enabled: d.voiceEnabled,
      assistant_enabled: d.assistantEnabled,
      followup_enabled: d.followupEnabled,
      insights_enabled: d.insightsEnabled,
      monthly_limit_usd: d.monthlyLimitUsd,
      assistant_info: d.assistantInfo,
      whatsapp_phone_number_id: d.whatsappPhoneNumberId || null,
      followup_queues: d.followupQueues,
      followup_min_days: d.followupMinDays,
    })
    .eq("clinic_id", session.clinic.id);
  if (error) return { error: error.code === "23505" ? "Esse número de WhatsApp já está ligado a outra clínica." : "Não foi possível salvar." };
  revalidatePath("/configuracoes/inteligencia-artificial");
  return {};
}

// Caixa de entrada do WhatsApp (recepção e gestão) -----------------------------------------------

async function frontDesk() {
  const session = await getSessionContext();
  if (!session?.clinic || session.clinic.role === "dentist") return null;
  return { session, supabase: await createClient() };
}

export async function setConversationMode(conversationId: string, mode: "bot" | "human"): Promise<{ error?: string }> {
  if (!z.uuid().safeParse(conversationId).success) return { error: "Conversa inválida." };
  const ctx = await frontDesk();
  if (!ctx) return { error: "Sem permissão." };
  const { data, error } = await ctx.supabase.from("whatsapp_conversations").update({ mode, unread: 0 }).eq("id", conversationId).select("id");
  if (error || !data?.length) return { error: "Não foi possível alterar." };
  revalidatePath("/whatsapp");
  return {};
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const ctx = await frontDesk();
  if (!ctx || !z.uuid().safeParse(conversationId).success) return;
  await ctx.supabase.from("whatsapp_conversations").update({ unread: 0 }).eq("id", conversationId);
}

/** Resposta da equipe: assume a conversa (o assistente para) e envia. */
export async function sendStaffReply(conversationId: string, text: string): Promise<{ error?: string }> {
  const parsed = z.object({ id: z.uuid(), text: z.string().trim().min(1).max(4000) }).safeParse({ id: conversationId, text });
  if (!parsed.success) return { error: "Escreva a mensagem." };
  const ctx = await frontDesk();
  if (!ctx) return { error: "Sem permissão." };
  const { data: c } = await ctx.supabase.from("whatsapp_conversations").select("id, clinic_id, phone, patient_id, mode, unread").eq("id", parsed.data.id).maybeSingle();
  if (!c) return { error: "Conversa não encontrada." };
  await ctx.supabase.from("whatsapp_conversations").update({ mode: "human", unread: 0 }).eq("id", c.id);
  await sendToConversation({ ...c, mode: "human" }, "staff", parsed.data.text, ctx.session.user.id);
  revalidatePath("/whatsapp");
  return {};
}

/** Teste do assistente sem WhatsApp configurado: simula uma mensagem do paciente. */
export async function simulateInbound(phone: string, text: string): Promise<{ error?: string; reply?: string | null }> {
  const ctx = await frontDesk();
  if (!ctx) return { error: "Sem permissão." };
  if (isMessagingConfigured()) return { error: "Com o WhatsApp configurado, teste pelo próprio WhatsApp." };
  const local = normalizePhone(phone);
  if (!local || !text.trim()) return { error: "Informe telefone e mensagem." };
  const result = await handleInboundMessage({ phoneNumberId: null, from: `55${local}`, text: text.trim(), clinicId: ctx.session.clinic!.id }).catch(() => null);
  revalidatePath("/whatsapp");
  if (!result?.handled) return { error: "Não foi possível identificar a clínica desta conversa." };
  return { reply: result.reply };
}

// Perguntas e resumo (gestão) --------------------------------------------------------------------

async function manager() {
  const session = await getSessionContext();
  if (!session?.clinic || (session.clinic.role !== "owner" && session.clinic.role !== "manager")) return null;
  return { session, clinicId: session.clinic.id, userId: session.user.id, supabase: await createClient() };
}

export async function askDataAction(question: string): Promise<{ error?: string; answer?: string }> {
  const q = question.trim();
  if (q.length < 5 || q.length > 500) return { error: "Escreva a pergunta (até 500 caracteres)." };
  const ctx = await manager();
  if (!ctx) return { error: "Só a gestão faz perguntas sobre os dados." };
  try {
    return await askData({ ...ctx, question: q });
  } catch {
    return { error: "A IA não respondeu agora. Tente de novo em instantes." };
  }
}

export async function monthlySummaryAction(month: string): Promise<{ error?: string; body?: string }> {
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "Mês inválido." };
  const ctx = await manager();
  if (!ctx) return { error: "Sem permissão." };
  try {
    const r = await monthlySummary({ ...ctx, month });
    revalidatePath("/analitico/ia");
    return r;
  } catch {
    return { error: "A IA não respondeu agora. Tente de novo em instantes." };
  }
}
