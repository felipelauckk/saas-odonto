"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/features/tenancy/queries";
import { canManageClinic } from "@/features/tenancy/roles";

type Result = { error?: string };

async function manager() {
  const session = await getSessionContext();
  if (!session?.clinic || !canManageClinic(session.clinic.role)) return null;
  return { clinicId: session.clinic.id, supabase: await createClient() };
}

function refresh() {
  revalidatePath("/configuracoes/pacientes");
  revalidatePath("/pacientes");
  revalidatePath("/crm");
}

const nameSchema = z.string().trim().min(1, "Dê um nome à origem.").max(60, "Nome muito longo.");

/** Nova origem no fim da lista. */
export async function addPatientSource(name: string): Promise<Result & { source?: { id: string; name: string; key: string | null; active: boolean; position: number } }> {
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const ctx = await manager();
  if (!ctx) return { error: "Só a gestão edita as origens." };
  const { data: last } = await ctx.supabase.from("patient_sources").select("position").order("position", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await ctx.supabase
    .from("patient_sources")
    .insert({ clinic_id: ctx.clinicId, name: parsed.data, position: Math.min((last?.position ?? -1) + 1, 999) })
    .select("id, name, key, active, position")
    .single();
  if (error) return { error: error.code === "23505" ? "Já existe uma origem com esse nome." : "Não foi possível incluir a origem." };
  refresh();
  return { source: data };
}

/** Renomeia ou liga/desliga uma origem (desligada some dos cadastros novos, mas não dos antigos). */
export async function updatePatientSource(input: { id: string; name?: string; active?: boolean }): Promise<Result> {
  const parsed = z.object({ id: z.uuid(), name: nameSchema.optional(), active: z.boolean().optional() }).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const ctx = await manager();
  if (!ctx) return { error: "Só a gestão edita as origens." };
  const { id, ...changes } = parsed.data;
  const { data, error } = await ctx.supabase.from("patient_sources").update(changes).eq("id", id).select("id");
  if (error) return { error: error.code === "23505" ? "Já existe uma origem com esse nome." : "Não foi possível salvar." };
  if (!data.length) return { error: "Origem não encontrada." };
  refresh();
  return {};
}

/** Nova ordem da lista (ids na ordem desejada). */
export async function reorderPatientSources(ids: string[]): Promise<Result> {
  const parsed = z.array(z.uuid()).max(200).safeParse(ids);
  if (!parsed.success) return { error: "Ordem inválida." };
  const ctx = await manager();
  if (!ctx) return { error: "Só a gestão edita as origens." };
  for (const [position, id] of parsed.data.entries()) {
    const { error } = await ctx.supabase.from("patient_sources").update({ position }).eq("id", id);
    if (error) return { error: "Não foi possível reordenar." };
  }
  refresh();
  return {};
}

const registrySchema = z.object({
  recordAuto: z.boolean(),
  recordNext: z.number().int().min(1, "O próximo número precisa ser 1 ou mais.").max(9_999_999),
  requireEmail: z.boolean(),
});

/** Numeração automática do prontuário e e-mail obrigatório no cadastro. */
export async function saveRegistrySettings(input: z.input<typeof registrySchema>): Promise<Result> {
  const parsed = registrySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const ctx = await manager();
  if (!ctx) return { error: "Só a gestão altera essas regras." };
  const { data, error } = await ctx.supabase
    .from("clinics")
    .update({ patient_record_auto: parsed.data.recordAuto, patient_record_next: parsed.data.recordNext, require_patient_email: parsed.data.requireEmail })
    .eq("id", ctx.clinicId)
    .select("id");
  if (error || !data.length) return { error: "Não foi possível salvar." };
  refresh();
  return {};
}
