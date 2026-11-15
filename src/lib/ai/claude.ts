import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

import { costUsd, type Usage } from "./cost";

/** Modelo usado em todos os recursos de IA. */
export const AI_MODEL = "claude-opus-5-5";

/**
 * Se o modelo recusar por política de segurança, a própria API refaz o pedido
 * num modelo alternativo escolhido pela categoria da recusa (fallback no servidor).
 */
export const AI_FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };

export type AiFeature = Database["public"]["Enums"]["ai_feature"];

export const aiFeatureLabels: Record<AiFeature, string> = {
  voice: "Registro por voz",
  assistant: "Assistente de WhatsApp",
  followup: "Follow-up da CRC",
  insights: "Perguntas e resumo",
};

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
/** Cliente da API (chave só no servidor: ANTHROPIC_API_KEY). */
export function aiClient(): Anthropic {
  client ??= new Anthropic();
  return client;
}

const settingColumn: Record<AiFeature, "voice_enabled" | "assistant_enabled" | "followup_enabled" | "insights_enabled"> = {
  voice: "voice_enabled",
  assistant: "assistant_enabled",
  followup: "followup_enabled",
  insights: "insights_enabled",
};

/** Gasto do mês corrente (US$) da clínica. */
export async function monthSpendUsd(clinicId: string): Promise<number> {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const { data } = await createAdminClient().from("ai_usage_log").select("cost_usd").eq("clinic_id", clinicId).gte("created_at", start.toISOString()).limit(100000);
  return (data ?? []).reduce((s, r) => s + Number(r.cost_usd), 0);
}

/** O recurso está ligado na clínica, a chave existe e o limite do mês não estourou? */
export async function checkAiAccess(clinicId: string, feature: AiFeature): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isAiConfigured()) return { ok: false, error: "IA não configurada no servidor (ANTHROPIC_API_KEY)." };
  const { data: s } = await createAdminClient().from("clinic_ai_settings").select("*").eq("clinic_id", clinicId).maybeSingle();
  if (!s?.[settingColumn[feature]]) return { ok: false, error: `${aiFeatureLabels[feature]} está desligado. A gestão liga em Configurações > Inteligência artificial.` };
  if ((await monthSpendUsd(clinicId)) >= Number(s.monthly_limit_usd)) return { ok: false, error: "Limite mensal de uso de IA da clínica atingido." };
  return { ok: true };
}

/** Registra quem pediu, o recurso e quanto custou. */
export async function recordAiUsage(input: { clinicId: string; userId: string | null; feature: AiFeature; usage: Usage; model?: string }) {
  const model = input.model ?? AI_MODEL;
  await createAdminClient()
    .from("ai_usage_log")
    .insert({
      clinic_id: input.clinicId,
      user_id: input.userId,
      feature: input.feature,
      model,
      input_tokens: input.usage.input_tokens,
      output_tokens: input.usage.output_tokens,
      cache_read_tokens: input.usage.cache_read_input_tokens ?? 0,
      cache_write_tokens: input.usage.cache_creation_input_tokens ?? 0,
      cost_usd: costUsd(model, input.usage),
    });
}
