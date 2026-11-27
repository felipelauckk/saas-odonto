"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionContext } from "@/features/tenancy/queries";
import { formValues, type ActionState } from "@/lib/action-state";
import { subscriptionErrorMessage } from "@/lib/db-errors";
import { parseBRLToCents } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

import { leadSchema, phoneField, referralColumns } from "./schemas";

type Result = { error?: string };

async function frontDesk() {
  const session = await getSessionContext();
  if (!session?.clinic || session.clinic.role === "dentist") return null;
  return { session, clinicId: session.clinic.id, supabase: await createClient() };
}

function crmError(error: { code?: string; message?: string }, fallback: string) {
  if (error.code === "OC001" || error.code === "OC002") return error.message ?? fallback;
  return subscriptionErrorMessage(error) ?? fallback;
}

function refresh() {
  revalidatePath("/crm");
}

// Leads ----------------------------------------------------------------------------------------

export async function saveLead(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = leadSchema.safeParse(values);
  if (!parsed.success) return { status: "error", message: "Confira os campos.", fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  const ctx = await frontDesk();
  if (!ctx) return { status: "error", message: "Sem permissão.", values };
  const d = parsed.data;
  const row = {
    name: d.name,
    phone: d.phone,
    email: d.email,
    source_id: d.sourceId,
    campaign_id: d.campaignId,
    procedure_id: d.procedureId,
    interest: d.interest,
    notes: d.notes,
    ...referralColumns(d.referral),
  };
  let stageId = d.stageId;
  if (!d.id && !stageId) {
    const { data: first } = await ctx.supabase.from("crm_stages").select("id").eq("auto_key", "new").maybeSingle();
    stageId = first?.id ?? null;
  }
  const { error } = d.id
    ? await ctx.supabase.from("leads").update(row).eq("id", d.id)
    : await ctx.supabase.from("leads").insert({ ...row, clinic_id: ctx.clinicId, stage_id: stageId!, created_by: ctx.session.user.id });
  if (error) return { status: "error", message: crmError(error, "Não foi possível salvar o lead."), values };
  refresh();
  return { status: "success", message: d.id ? "Lead salvo." : "Lead criado." };
}

export async function moveLead(input: { id: string; stageId: string; lostReason?: string }): Promise<Result> {
  const parsed = z.object({ id: z.uuid(), stageId: z.uuid(), lostReason: z.string().trim().max(200).optional() }).safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos." };
  const ctx = await frontDesk();
  if (!ctx) return { error: "Sem permissão." };
  const { data, error } = await ctx.supabase
    .from("leads")
    .update({ stage_id: parsed.data.stageId, lost_reason: parsed.data.lostReason || null })
    .eq("id", parsed.data.id)
    .select("id");
  if (error) return { error: crmError(error, "Não foi possível mover o lead.") };
  if (!data.length) return { error: "Lead não encontrado." };
  refresh();
  return {};
}

/**
 * Converte o lead em paciente: se já existe paciente com o mesmo telefone,
 * reaproveita; senão cadastra com nome, telefone, e-mail, origem e indicação.
 */
export async function convertLead(id: string): Promise<Result & { patientId?: string }> {
  if (!z.uuid().safeParse(id).success) return { error: "Lead inválido." };
  const ctx = await frontDesk();
  if (!ctx) return { error: "Sem permissão." };
  const { data: lead } = await ctx.supabase
    .from("leads")
    .select("id, name, phone, email, source_id, patient_id, referred_by_patient_id, referred_by_partner_id")
    .eq("id", id)
    .maybeSingle();
  if (!lead) return { error: "Lead não encontrado." };
  if (lead.patient_id) return { patientId: lead.patient_id };

  let patientId: string | null = null;
  if (lead.phone) {
    const { data: existing } = await ctx.supabase
      .from("patients")
      .select("id")
      .or(`phone.eq.${lead.phone},whatsapp.eq.${lead.phone}`)
      .is("archived_at", null)
      .limit(1);
    patientId = existing?.[0]?.id ?? null;
  }
  if (!patientId) {
    const { data: created, error } = await ctx.supabase
      .from("patients")
      .insert({
        clinic_id: ctx.clinicId,
        full_name: lead.name,
        phone: lead.phone,
        whatsapp: lead.phone,
        email: lead.email,
        source_id: lead.source_id,
        referred_by_patient_id: lead.referred_by_patient_id,
        referred_by_partner_id: lead.referred_by_partner_id,
      })
      .select("id")
      .single();
    if (error) return { error: crmError(error, "Não foi possível cadastrar o paciente.") };
    patientId = created.id;
  }
  const { error } = await ctx.supabase.from("leads").update({ patient_id: patientId }).eq("id", id);
  if (error) return { error: crmError(error, "Não foi possível vincular o paciente.") };
  refresh();
  revalidatePath("/pacientes");
  return { patientId };
}

// Configuração (gestão) ---------------------------------------------------------------------------

async function manager() {
  const ctx = await frontDesk();
  if (!ctx || (ctx.session.clinic!.role !== "owner" && ctx.session.clinic!.role !== "manager")) return null;
  return ctx;
}

function settingsRefresh() {
  revalidatePath("/configuracoes/crm");
  refresh();
}

export async function saveStage(input: { id?: string; name: string }): Promise<Result> {
  const parsed = z.object({ id: z.uuid().optional(), name: z.string().trim().min(1, "Informe o nome.").max(40) }).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const ctx = await manager();
  if (!ctx) return { error: "Sem permissão." };
  if (parsed.data.id) {
    const { error } = await ctx.supabase.from("crm_stages").update({ name: parsed.data.name }).eq("id", parsed.data.id);
    if (error) return { error: crmError(error, "Não foi possível salvar a etapa.") };
  } else {
    // Etapas novas entram antes de "Fechou".
    const { data: stages } = await ctx.supabase.from("crm_stages").select("position, kind").order("position");
    const lastOpen = Math.max(0, ...(stages ?? []).filter((s) => s.kind === "open").map((s) => s.position));
    const { error } = await ctx.supabase.from("crm_stages").insert({ clinic_id: ctx.clinicId, name: parsed.data.name, position: lastOpen + 5 });
    if (error) return { error: crmError(error, "Não foi possível criar a etapa.") };
  }
  settingsRefresh();
  return {};
}

/** Sobe ou desce uma etapa aberta (Fechou e Perdido ficam sempre no fim). */
export async function moveStage(id: string, direction: "up" | "down"): Promise<Result> {
  const ctx = await manager();
  if (!ctx) return { error: "Sem permissão." };
  const { data: stages } = await ctx.supabase.from("crm_stages").select("id, position, kind").eq("kind", "open").order("position");
  const list = stages ?? [];
  const i = list.findIndex((s) => s.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return {};
  const a = list[i]!;
  const b = list[j]!;
  await ctx.supabase.from("crm_stages").update({ position: b.position }).eq("id", a.id);
  await ctx.supabase.from("crm_stages").update({ position: a.position }).eq("id", b.id);
  settingsRefresh();
  return {};
}

export async function deleteStage(id: string): Promise<Result> {
  if (!z.uuid().safeParse(id).success) return { error: "Etapa inválida." };
  const ctx = await manager();
  if (!ctx) return { error: "Sem permissão." };
  const { count } = await ctx.supabase.from("leads").select("id", { count: "exact", head: true }).eq("stage_id", id);
  if (count) return { error: "Mova os leads desta etapa antes de excluí-la." };
  const { error } = await ctx.supabase.from("crm_stages").delete().eq("id", id);
  if (error) return { error: crmError(error, "Não foi possível excluir a etapa.") };
  settingsRefresh();
  return {};
}

export async function saveCampaign(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = z
    .object({
      id: z.string().optional().transform((v) => v || undefined).pipe(z.uuid().optional()),
      name: z.string().trim().min(2, "Informe o nome.").max(80),
      sourceId: z.string().optional().transform((v) => (v && v !== "none" ? v : null)).pipe(z.uuid().nullable()),
      cost: z.string().optional().transform((v, c) => {
        const cents = parseBRLToCents(v ? v : "0");
        if (cents === null) {
          c.addIssue({ code: "custom", message: "Valor inválido. Ex.: 500,00" });
          return z.NEVER;
        }
        return cents;
      }),
      active: z.string().optional().transform((v) => v === "on"),
    })
    .safeParse(values);
  if (!parsed.success) return { status: "error", message: "Confira os campos.", fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  const ctx = await manager();
  if (!ctx) return { status: "error", message: "Sem permissão.", values };
  const { id, name, sourceId, cost, active } = parsed.data;
  const row = { name, source_id: sourceId, cost_cents: cost, active };
  const { error } = id
    ? await ctx.supabase.from("crm_campaigns").update(row).eq("id", id)
    : await ctx.supabase.from("crm_campaigns").insert({ ...row, clinic_id: ctx.clinicId });
  if (error) return { status: "error", message: error.code === "23505" ? "Já existe uma campanha com esse nome." : crmError(error, "Não foi possível salvar."), values };
  settingsRefresh();
  return { status: "success", message: "Campanha salva." };
}

export async function savePartner(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = z
    .object({
      id: z.string().optional().transform((v) => v || undefined).pipe(z.uuid().optional()),
      name: z.string().trim().min(2, "Informe o nome.").max(120),
      phone: phoneField,
      notes: z.string().trim().max(300).optional().transform((v) => v || null),
      active: z.string().optional().transform((v) => v === "on"),
    })
    .safeParse(values);
  if (!parsed.success) return { status: "error", message: "Confira os campos.", fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  const ctx = await frontDesk();
  if (!ctx) return { status: "error", message: "Sem permissão.", values };
  const { id, ...row } = parsed.data;
  const { error } = id
    ? await ctx.supabase.from("referral_partners").update(row).eq("id", id)
    : await ctx.supabase.from("referral_partners").insert({ ...row, clinic_id: ctx.clinicId });
  if (error) return { status: "error", message: crmError(error, "Não foi possível salvar."), values };
  settingsRefresh();
  return { status: "success", message: "Parceiro salvo." };
}

export async function regenerateLeadFormLink(): Promise<Result> {
  const ctx = await manager();
  if (!ctx) return { error: "Sem permissão." };
  const { error } = await ctx.supabase.rpc("regenerate_lead_form_token");
  if (error) return { error: "Não foi possível gerar um novo link." };
  settingsRefresh();
  return {};
}
