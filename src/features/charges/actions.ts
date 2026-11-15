"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionContext } from "@/features/tenancy/queries";
import { AsaasClinicError } from "@/lib/asaas-clinic";
import { subscriptionErrorMessage } from "@/lib/db-errors";
import { isSecretsConfigured } from "@/lib/secrets";
import { createClient } from "@/lib/supabase/server";

import { cancelCharge, connectClinicAsaas, createCharge, disconnectClinicAsaas, type ChargeView } from "./service";

type Result = { error?: string };

async function context(managersOnly = false) {
  const session = await getSessionContext();
  const role = session?.clinic?.role;
  if (!session?.clinic || role === "dentist") return null;
  if (managersOnly && role !== "owner" && role !== "manager") return null;
  return { session, clinicId: session.clinic.id, userId: session.user.id, supabase: await createClient() };
}

function refresh() {
  revalidatePath("/financeiro");
  revalidatePath("/pacientes", "layout");
}

export async function connectAsaasAction(input: { apiKey: string; environment: "sandbox" | "production" }): Promise<Result> {
  const parsed = z.object({ apiKey: z.string().trim().min(20, "Cole a chave de API completa.").max(300), environment: z.enum(["sandbox", "production"]) }).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const ctx = await context(true);
  if (!ctx) return { error: "Sem permissão." };
  if (!isSecretsConfigured()) return { error: "O servidor ainda não tem a chave de criptografia (CLINIC_SECRETS_KEY)." };
  try {
    await connectClinicAsaas(ctx.clinicId, parsed.data.apiKey, parsed.data.environment);
  } catch (error) {
    return { error: error instanceof AsaasClinicError || error instanceof Error ? error.message : "Não foi possível conectar." };
  }
  revalidatePath("/configuracoes/cobranca");
  return {};
}

export async function disconnectAsaasAction(): Promise<Result> {
  const ctx = await context(true);
  if (!ctx) return { error: "Sem permissão." };
  await disconnectClinicAsaas(ctx.clinicId);
  revalidatePath("/configuracoes/cobranca");
  return {};
}

const chargeSchema = z.object({
  receivableIds: z.array(z.uuid()).min(1).max(60),
  kind: z.enum(["pix", "boleto", "link"]),
  installments: z.number().int().min(1).max(12),
  dueDate: z.iso.date().nullable(),
});

export async function createChargeAction(input: z.input<typeof chargeSchema>): Promise<Result & { charge?: ChargeView }> {
  const parsed = chargeSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos." };
  const ctx = await context();
  if (!ctx) return { error: "Sem permissão." };
  try {
    const result = await createCharge(ctx, parsed.data);
    if (!result.error) refresh();
    return result;
  } catch (error) {
    return { error: error instanceof AsaasClinicError ? error.message : "Não foi possível gerar a cobrança agora." };
  }
}

export async function cancelChargeAction(chargeId: string): Promise<Result> {
  if (!z.uuid().safeParse(chargeId).success) return { error: "Cobrança inválida." };
  const ctx = await context();
  if (!ctx) return { error: "Sem permissão." };
  const result = await cancelCharge(ctx, chargeId);
  if (!result.error) refresh();
  return result;
}

export async function setNegotiation(receivableId: string, value: boolean): Promise<Result> {
  if (!z.uuid().safeParse(receivableId).success) return { error: "Parcela inválida." };
  const ctx = await context();
  if (!ctx) return { error: "Sem permissão." };
  const { data, error } = await ctx.supabase.from("receivables").update({ in_negotiation: value }).eq("id", receivableId).select("id");
  if (error) return { error: subscriptionErrorMessage(error) ?? "Não foi possível alterar." };
  if (!data.length) return { error: "Parcela não encontrada." };
  refresh();
  return {};
}

// Régua (gestão) -----------------------------------------------------------------------------

export async function saveDunningStep(input: { id?: string; offsetDays: number; body: string; active: boolean }): Promise<Result> {
  const parsed = z
    .object({ id: z.uuid().optional(), offsetDays: z.number().int().min(-30).max(90), body: z.string().trim().min(5, "Escreva a mensagem.").max(1000), active: z.boolean() })
    .safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const ctx = await context(true);
  if (!ctx) return { error: "Sem permissão." };
  const { id, offsetDays, body, active } = parsed.data;
  const { error } = id
    ? await ctx.supabase.from("dunning_steps").update({ body, active }).eq("id", id)
    : await ctx.supabase.from("dunning_steps").insert({ clinic_id: ctx.clinicId, offset_days: offsetDays, body, active });
  if (error) return { error: error.code === "23505" ? "Já existe uma etapa nesse dia." : (subscriptionErrorMessage(error) ?? "Não foi possível salvar.") };
  revalidatePath("/configuracoes/cobranca");
  return {};
}

export async function deleteDunningStep(id: string): Promise<Result> {
  const ctx = await context(true);
  if (!ctx) return { error: "Sem permissão." };
  const { error } = await ctx.supabase.from("dunning_steps").delete().eq("id", id);
  if (error) return { error: "Não foi possível excluir." };
  revalidatePath("/configuracoes/cobranca");
  return {};
}
