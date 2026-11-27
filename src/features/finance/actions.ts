"use server";

import type { PostgrestError } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { autoIssueInvoices } from "@/features/invoices/service";
import { getSessionContext } from "@/features/tenancy/queries";
import { subscriptionErrorMessage } from "@/lib/db-errors";
import { todayIso } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

type Result = { error?: string };

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");

function financeError(error: PostgrestError): string {
  const blocked = subscriptionErrorMessage(error);
  if (blocked) return blocked;
  if (error.code === "42501") return error.message.includes("row-level") ? "Você não tem permissão para esta ação." : error.message;
  if (error.code?.startsWith("OF") || error.code === "P0002") return error.message;
  return "Não foi possível concluir. Tente novamente.";
}

function revalidate() {
  revalidatePath("/financeiro", "layout");
  revalidatePath("/pacientes", "layout");
}

const receiveSchema = z.object({
  receivableId: z.uuid(),
  paidAmountCents: z.number().int().positive("Informe o valor recebido."),
  paymentMethodId: z.uuid({ message: "Escolha a forma de pagamento." }),
  paidOn: isoDate,
  /** Valor a mais vira crédito do paciente (P7). */
  keepCredit: z.boolean().default(false),
});

export async function receivePayment(input: z.input<typeof receiveSchema>): Promise<Result> {
  const parsed = receiveSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const supabase = await createClient();
  const args = {
    _receivable_id: parsed.data.receivableId,
    _paid_amount_cents: parsed.data.paidAmountCents,
    _payment_method_id: parsed.data.paymentMethodId,
    _paid_on: parsed.data.paidOn,
  };
  const { error } = parsed.data.keepCredit ? await supabase.rpc("receive_payment_with_credit", args) : await supabase.rpc("receive_payment", args);
  if (error) return { error: financeError(error) };
  // Nota fiscal automática (se a clínica ligou); erro de emissão fica registrado na nota.
  const session = await getSessionContext();
  if (session?.clinic) await autoIssueInvoices(session.clinic.id, [parsed.data.receivableId]);
  revalidate();
  return {};
}

export async function reversePayment(receivableId: string): Promise<Result> {
  if (!z.uuid().safeParse(receivableId).success) return { error: "Conta inválida." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("reverse_payment", { _receivable_id: receivableId });
  if (error) return { error: financeError(error) };
  revalidate();
  return {};
}

export async function cancelReceivable(receivableId: string): Promise<Result> {
  if (!z.uuid().safeParse(receivableId).success) return { error: "Conta inválida." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_receivable", { _receivable_id: receivableId });
  if (error) return { error: financeError(error) };
  revalidate();
  return {};
}

const receivableSchema = z.object({
  patientId: z.uuid({ message: "Escolha o paciente." }),
  description: z.string().trim().min(2, "Descreva a cobrança.").max(200),
  amountCents: z.number().int().positive("Informe o valor."),
  dueDate: isoDate,
});

export async function createReceivable(input: z.input<typeof receivableSchema>): Promise<Result> {
  const parsed = receivableSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const session = await getSessionContext();
  if (!session?.clinic || !session.activeUnit) return { error: "Sessão expirada. Entre novamente." };
  const supabase = await createClient();
  const { error } = await supabase.from("receivables").insert({
    clinic_id: session.clinic.id,
    unit_id: session.activeUnit.id,
    patient_id: parsed.data.patientId,
    description: parsed.data.description,
    amount_cents: parsed.data.amountCents,
    due_date: parsed.data.dueDate,
    created_by: session.user.id,
  });
  if (error) return { error: financeError(error) };
  revalidate();
  return {};
}

const movementSchema = z.object({
  type: z.enum(["in", "out"]),
  amountCents: z.number().int().positive("Informe o valor."),
  description: z.string().trim().min(2, "Descreva o lançamento.").max(200),
  paymentMethodId: z.uuid().nullable(),
  categoryId: z.uuid().nullable().optional(),
});

export async function addCashMovement(input: z.input<typeof movementSchema>): Promise<Result> {
  const parsed = movementSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const session = await getSessionContext();
  if (!session?.clinic || !session.activeUnit) return { error: "Sessão expirada. Entre novamente." };
  const supabase = await createClient();
  const { error } = await supabase.from("cash_movements").insert({
    clinic_id: session.clinic.id,
    unit_id: session.activeUnit.id,
    type: parsed.data.type,
    amount_cents: parsed.data.amountCents,
    description: parsed.data.description,
    payment_method_id: parsed.data.paymentMethodId,
    category_id: parsed.data.categoryId ?? null,
    created_by: session.user.id,
  });
  if (error) return { error: financeError(error) };
  revalidate();
  return {};
}

// Crédito do paciente (P7) -----------------------------------------------------------------

/** Saldo de crédito do paciente (0 para quem não opera o financeiro). */
export async function loadPatientCredit(patientId: string): Promise<number> {
  if (!z.uuid().safeParse(patientId).success) return 0;
  const supabase = await createClient();
  const { data } = await supabase.rpc("patient_credit_balance", { _patient_id: patientId });
  return data ?? 0;
}

/** Paga a parcela inteira com o crédito do paciente (sem entrada no caixa). */
export async function payWithCredit(input: { receivableId: string; paidOn: string }): Promise<Result> {
  const parsed = z.object({ receivableId: z.uuid(), paidOn: isoDate }).safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("use_patient_credit", { _receivable_id: parsed.data.receivableId, _paid_on: parsed.data.paidOn });
  if (error) return { error: financeError(error) };
  revalidate();
  return {};
}

const creditSchema = z.object({
  patientId: z.uuid(),
  amountCents: z.number().int().positive("Informe o valor."),
  notes: z.string().trim().max(300).optional(),
});

/** Lançamento manual de crédito (só a gestão; o banco confere). */
export async function addManualCredit(input: z.input<typeof creditSchema>): Promise<Result> {
  const parsed = creditSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_patient_credit", { _patient_id: parsed.data.patientId, _amount_cents: parsed.data.amountCents, _notes: parsed.data.notes || "Lançamento manual" });
  if (error) return { error: financeError(error) };
  revalidate();
  return {};
}

// Mensalidades (P7) ------------------------------------------------------------------------

const subscriptionSchema = z.object({
  patientId: z.uuid(),
  description: z.string().trim().min(2, "Descreva a mensalidade.").max(120),
  amountCents: z.number().int().positive("Informe o valor."),
  dueDay: z.number().int().min(1, "Dia entre 1 e 28.").max(28, "Dia entre 1 e 28."),
  startsOn: isoDate,
  endsOn: isoDate.nullable(),
});

/** Cria a mensalidade e já gera as parcelas até o mês seguinte. */
export async function createSubscription(input: z.input<typeof subscriptionSchema>): Promise<Result> {
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const d = parsed.data;
  if (d.endsOn && d.endsOn < d.startsOn) return { error: "O fim não pode ser antes do início." };
  const session = await getSessionContext();
  if (!session?.clinic || !session.activeUnit) return { error: "Sessão expirada. Entre novamente." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patient_subscriptions")
    .insert({
      clinic_id: session.clinic.id,
      unit_id: session.activeUnit.id,
      patient_id: d.patientId,
      description: d.description,
      amount_cents: d.amountCents,
      due_day: d.dueDay,
      starts_on: d.startsOn,
      ends_on: d.endsOn,
    })
    .select("id")
    .single();
  if (error) return { error: error.code === "42501" ? "Você não tem permissão para criar mensalidades." : financeError(error) };
  const { error: genError } = await supabase.rpc("generate_my_subscription_receivables", { _subscription_id: data.id });
  if (genError) return { error: financeError(genError) };
  revalidate();
  return {};
}

/** Encerra a mensalidade: para de gerar; as parcelas já geradas ficam. */
export async function endSubscription(id: string): Promise<Result> {
  if (!z.uuid().safeParse(id).success) return { error: "Mensalidade inválida." };
  const supabase = await createClient();
  const { data: current } = await supabase.from("patient_subscriptions").select("starts_on").eq("id", id).maybeSingle();
  if (!current) return { error: "Mensalidade não encontrada." };
  const today = todayIso();
  const { data, error } = await supabase
    .from("patient_subscriptions")
    .update({ active: false, ends_on: today > current.starts_on ? today : current.starts_on })
    .eq("id", id)
    .select("id");
  if (error) return { error: financeError(error) };
  if (!data.length) return { error: "Mensalidade não encontrada." };
  revalidate();
  return {};
}
