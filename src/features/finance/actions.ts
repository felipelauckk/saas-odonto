"use server";

import type { PostgrestError } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { subscriptionErrorMessage } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/features/tenancy/queries";

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
});

export async function receivePayment(input: z.input<typeof receiveSchema>): Promise<Result> {
  const parsed = receiveSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("receive_payment", {
    _receivable_id: parsed.data.receivableId,
    _paid_amount_cents: parsed.data.paidAmountCents,
    _payment_method_id: parsed.data.paymentMethodId,
    _paid_on: parsed.data.paidOn,
  });
  if (error) return { error: financeError(error) };
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
    created_by: session.user.id,
  });
  if (error) return { error: financeError(error) };
  revalidate();
  return {};
}
