"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionContext } from "@/features/tenancy/queries";
import { formValues, type ActionState } from "@/lib/action-state";
import { subscriptionErrorMessage } from "@/lib/db-errors";
import { onlyDigits } from "@/lib/documents";
import { parseBRLToCents } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

import type { ProstheticStage } from "./labels";

type Result = { error?: string };

async function context() {
  const session = await getSessionContext();
  if (!session?.clinic || !session.activeUnit) return null;
  return { session, clinicId: session.clinic.id, unitId: session.activeUnit.id, supabase: await createClient() };
}

function errorOf(error: { code?: string; message?: string }, fallback: string) {
  if (error.code?.startsWith("OP")) return error.message ?? fallback;
  return subscriptionErrorMessage(error) ?? fallback;
}

function refresh(patientId?: string) {
  revalidatePath("/proteses");
  if (patientId) revalidatePath(`/pacientes/${patientId}`, "layout");
}

const optionalDate = z.iso.date().nullable();

const orderSchema = z
  .object({
    id: z.uuid().optional(),
    patientId: z.uuid({ message: "Escolha o paciente." }),
    professionalId: z.uuid().nullable(),
    planItemId: z.uuid().nullable(),
    labId: z.uuid().nullable(),
    labServiceId: z.uuid().nullable(),
    kind: z.enum(["prosthesis", "aligner"]),
    workType: z.string().trim().min(2, "Informe o tipo de trabalho.").max(120),
    teeth: z.array(z.number().int().min(11).max(85)).max(32),
    shade: z.string().trim().max(40).nullable(),
    material: z.string().trim().max(80).nullable(),
    sentOn: optionalDate,
    expectedReturnOn: optionalDate,
    cost: z.string(),
    alignerTotal: z.number().int().min(1).max(99).nullable(),
    alignerChangeDays: z.number().int().min(1).max(60).nullable(),
    alignerStartedOn: optionalDate,
    notes: z.string().trim().max(1000).nullable(),
  })
  .refine((d) => d.kind === "prosthesis" || (d.alignerTotal && d.alignerChangeDays), { message: "Informe o número de placas e a troca em dias.", path: ["alignerTotal"] })
  .refine((d) => !d.sentOn || !d.expectedReturnOn || d.expectedReturnOn >= d.sentOn, { message: "O retorno previsto não pode ser antes do envio.", path: ["expectedReturnOn"] });

export type OrderInput = z.input<typeof orderSchema>;

export async function saveOrder(input: OrderInput): Promise<Result & { fieldErrors?: Record<string, string[] | undefined> }> {
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os campos.", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const cost = parseBRLToCents(parsed.data.cost.trim() || "0");
  if (cost === null) return { error: "Custo inválido. Ex.: 350,00" };
  const ctx = await context();
  if (!ctx) return { error: "Sessão expirada." };
  const d = parsed.data;
  const row = {
    professional_id: d.professionalId,
    plan_item_id: d.planItemId,
    lab_id: d.labId,
    lab_service_id: d.labServiceId,
    work_type: d.workType,
    teeth: d.teeth,
    shade: d.shade || null,
    material: d.material || null,
    sent_on: d.sentOn,
    expected_return_on: d.expectedReturnOn,
    cost_cents: cost,
    aligner_total: d.kind === "aligner" ? d.alignerTotal : null,
    aligner_change_days: d.kind === "aligner" ? d.alignerChangeDays : null,
    aligner_started_on: d.kind === "aligner" ? d.alignerStartedOn : null,
    notes: d.notes || null,
  };
  const { error } = d.id
    ? await ctx.supabase.from("prosthetic_orders").update(row).eq("id", d.id)
    : await ctx.supabase.from("prosthetic_orders").insert({ ...row, clinic_id: ctx.clinicId, unit_id: ctx.unitId, patient_id: d.patientId, kind: d.kind, created_by: ctx.session.user.id });
  if (error) return { error: errorOf(error, "Não foi possível salvar a ordem.") };
  refresh(d.patientId);
  return {};
}

export async function moveOrder(id: string, stage: ProstheticStage): Promise<Result> {
  const parsed = z.object({ id: z.uuid(), stage: z.enum(["impression", "sent", "try_in", "adjustment", "ready", "delivered", "canceled"]) }).safeParse({ id, stage });
  if (!parsed.success) return { error: "Dados inválidos." };
  const ctx = await context();
  if (!ctx) return { error: "Sessão expirada." };
  const { data, error } = await ctx.supabase.from("prosthetic_orders").update({ stage: parsed.data.stage }).eq("id", id).select("patient_id");
  if (error) return { error: errorOf(error, "Não foi possível mover a ordem.") };
  if (!data.length) return { error: "Ordem não encontrada." };
  refresh(data[0]!.patient_id);
  return {};
}

/** Registra a entrega de mais placas (alinhadores). A primeira entrega marca o início. */
export async function deliverAligners(id: string, count: number): Promise<Result> {
  if (!z.uuid().safeParse(id).success || !Number.isInteger(count) || count < 1 || count > 99) return { error: "Quantidade inválida." };
  const ctx = await context();
  if (!ctx) return { error: "Sessão expirada." };
  const { data: o } = await ctx.supabase.from("prosthetic_orders").select("patient_id, aligners_delivered, aligner_total, aligner_started_on").eq("id", id).maybeSingle();
  if (!o || !o.aligner_total) return { error: "Ordem não encontrada." };
  const delivered = Math.min(o.aligner_total, o.aligners_delivered + count);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const { error } = await ctx.supabase
    .from("prosthetic_orders")
    .update({ aligners_delivered: delivered, aligner_started_on: o.aligner_started_on ?? today, stage: "delivered" })
    .eq("id", id);
  if (error) return { error: errorOf(error, "Não foi possível registrar a entrega.") };
  refresh(o.patient_id);
  return {};
}

export async function launchLabPayable(id: string): Promise<Result> {
  if (!z.uuid().safeParse(id).success) return { error: "Ordem inválida." };
  const ctx = await context();
  if (!ctx) return { error: "Sessão expirada." };
  const { error } = await ctx.supabase.rpc("create_lab_payable", { _order_id: id });
  if (error) return { error: error.code === "42501" ? "Só a gestão lança contas a pagar." : errorOf(error, "Não foi possível lançar a conta.") };
  refresh();
  revalidatePath("/financeiro/pagar");
  return {};
}

/** Itens de orçamento aprovados do paciente (para ligar a ordem). */
export async function patientPlanItems(patientId: string): Promise<{ id: string; label: string }[]> {
  if (!z.uuid().safeParse(patientId).success) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("treatment_items")
    .select("id, description, tooth, status, treatment_plans!inner(patient_id, status)")
    .eq("treatment_plans.patient_id", patientId)
    .in("treatment_plans.status", ["approved", "partially_approved", "completed"])
    .in("status", ["approved", "done"]);
  return (data ?? []).map((i) => ({ id: i.id, label: `${i.description}${i.tooth ? ` (dente ${i.tooth})` : ""}` }));
}

/** Ordens ainda no laboratório: a agenda avisa para não marcar antes do retorno previsto. */
export async function labWarnings(patientId: string): Promise<{ workType: string; labName: string | null; expectedReturnOn: string }[]> {
  if (!z.uuid().safeParse(patientId).success) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("prosthetic_orders")
    .select("work_type, expected_return_on, labs(name)")
    .eq("patient_id", patientId)
    .in("stage", ["impression", "sent"])
    .not("expected_return_on", "is", null);
  return (data ?? []).map((o) => ({ workType: o.work_type, labName: o.labs?.name ?? null, expectedReturnOn: o.expected_return_on! }));
}

// Laboratórios (gestão) ------------------------------------------------------------------------

const idField = z.string().optional().transform((v) => v || undefined).pipe(z.uuid().optional());

export async function saveLab(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = z
    .object({
      id: idField,
      name: z.string().trim().min(2, "Informe o nome.").max(120),
      contact_name: z.string().trim().max(120).transform((v) => v || null),
      phone: z.string().transform(onlyDigits).refine((d) => d === "" || /^\d{10,11}$/.test(d), "Telefone inválido.").transform((d) => d || null),
      email: z.string().trim().max(160).transform((v) => v || null),
      notes: z.string().trim().max(500).transform((v) => v || null),
      active: z.string().optional().transform((v) => v === "on"),
    })
    .safeParse({ contact_name: "", email: "", notes: "", phone: "", ...values });
  if (!parsed.success) return { status: "error", message: "Confira os campos.", fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  const ctx = await context();
  if (!ctx) return { status: "error", message: "Sessão expirada.", values };
  const { id, ...row } = parsed.data;
  const { data, error } = id
    ? await ctx.supabase.from("labs").update(row).eq("id", id).select("id")
    : await ctx.supabase.from("labs").insert({ ...row, clinic_id: ctx.clinicId }).select("id");
  if (error || !data.length) return { status: "error", message: error ? errorOf(error, "Não foi possível salvar.") : "Sem permissão.", values };
  revalidatePath("/configuracoes/laboratorios");
  return { status: "success", message: "Laboratório salvo." };
}

export async function saveLabService(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = z
    .object({
      id: idField,
      lab_id: z.uuid(),
      name: z.string().trim().min(2, "Informe o serviço.").max(120),
      price: z.string(),
      days: z.string().transform((v) => (v.trim() ? Number(v) : null)).pipe(z.number().int().min(0).max(180).nullable()),
      active: z.string().optional().transform((v) => v === "on"),
    })
    .safeParse({ days: "", price: "", ...values });
  if (!parsed.success) return { status: "error", message: "Confira os campos.", fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  const price = parseBRLToCents(parsed.data.price.trim() || "0");
  if (price === null) return { status: "error", message: "Preço inválido.", fieldErrors: { price: ["Preço inválido. Ex.: 350,00"] }, values };
  const ctx = await context();
  if (!ctx) return { status: "error", message: "Sessão expirada.", values };
  const { id, lab_id, name, days, active } = parsed.data;
  const { data, error } = id
    ? await ctx.supabase.from("lab_services").update({ name, price_cents: price, days, active }).eq("id", id).select("id")
    : await ctx.supabase.from("lab_services").insert({ clinic_id: ctx.clinicId, lab_id, name, price_cents: price, days, active }).select("id");
  if (error || !data.length) return { status: "error", message: error ? errorOf(error, "Não foi possível salvar.") : "Sem permissão.", values };
  revalidatePath("/configuracoes/laboratorios");
  return { status: "success", message: "Serviço salvo." };
}
