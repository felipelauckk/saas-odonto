"use server";

import type { PostgrestError } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { subscriptionErrorMessage } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/features/tenancy/queries";

type Result = { error?: string; id?: string };

const itemSchema = z.object({
  procedureId: z.uuid().nullable(),
  description: z.string().trim().min(1, "Descreva o item.").max(200),
  tooth: z.number().int().nullable(),
  faces: z.array(z.enum(["M", "D", "O", "V", "L"])).max(5),
  priceCents: z.number().int().min(0).max(100_000_000),
  sessionsPlanned: z.number().int().min(1).max(50).default(1),
});

const planSchema = z.object({
  id: z.uuid().optional(),
  patientId: z.uuid({ message: "Escolha o paciente." }),
  professionalId: z.uuid({ message: "Escolha o profissional." }),
  notes: z.string().trim().max(2000).optional(),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  items: z.array(itemSchema).min(1, "Inclua pelo menos um procedimento.").max(100),
});

export type PlanInput = z.input<typeof planSchema>;

function planError(error: PostgrestError): string {
  const blocked = subscriptionErrorMessage(error);
  if (blocked) return blocked;
  if (error.code === "OT001") return "Este orçamento já foi aprovado ou fechado e não pode ser alterado.";
  if (error.code?.startsWith("OT") || error.code === "P0002") return error.message;
  if (error.code === "42501") return "Você não tem permissão para esta ação.";
  if (error.code === "23514") return "Algum dente ou face está inválido.";
  return "Não foi possível salvar o orçamento. Tente novamente.";
}

function revalidate(planId: string, patientId?: string) {
  revalidatePath("/orcamentos");
  revalidatePath(`/orcamentos/${planId}`);
  if (patientId) revalidatePath(`/pacientes/${patientId}/orcamentos`);
}

export async function savePlan(input: PlanInput): Promise<Result> {
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const session = await getSessionContext();
  if (!session?.clinic || !session.activeUnit) return { error: "Sessão expirada. Entre novamente." };
  const supabase = await createClient();
  const { id, patientId, professionalId, notes, validUntil, items } = parsed.data;
  const clinicId = session.clinic.id;

  let planId = id;
  if (planId) {
    const { data, error } = await supabase
      .from("treatment_plans")
      .update({ professional_id: professionalId, notes: notes || null, valid_until: validUntil ?? null })
      .eq("id", planId)
      .select("id");
    if (error) return { error: planError(error) };
    if (!data.length) return { error: "Este orçamento não pode mais ser alterado." };
    // Substitui os itens (só funciona enquanto o orçamento está aberto: o banco garante).
    const { error: deleteError } = await supabase.from("treatment_items").delete().eq("plan_id", planId);
    if (deleteError) return { error: planError(deleteError) };
  } else {
    const { data, error } = await supabase
      .from("treatment_plans")
      .insert({
        clinic_id: clinicId,
        unit_id: session.activeUnit.id,
        patient_id: patientId,
        professional_id: professionalId,
        notes: notes || null,
        valid_until: validUntil ?? null,
        created_by: session.user.id,
      })
      .select("id")
      .single();
    if (error) return { error: planError(error) };
    planId = data.id;
  }

  const { error: itemsError } = await supabase.from("treatment_items").insert(
    items.map((item, position) => ({
      clinic_id: clinicId,
      plan_id: planId!,
      procedure_id: item.procedureId,
      description: item.description,
      tooth: item.tooth,
      faces: item.faces,
      price_cents: item.priceCents,
      sessions_planned: item.sessionsPlanned,
      position,
    })),
  );
  if (itemsError) return { error: planError(itemsError) };

  revalidate(planId, patientId);
  return { id: planId };
}

export async function setPlanStatus(planId: string, status: "presented" | "rejected"): Promise<Result> {
  if (!z.uuid().safeParse(planId).success) return { error: "Orçamento inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("treatment_plans")
    .update({ status, ...(status === "presented" ? { presented_at: new Date().toISOString() } : {}) })
    .eq("id", planId)
    .select("id, patient_id");
  if (error) return { error: planError(error) };
  if (!data.length) return { error: "Este orçamento não pode mais ser alterado." };
  revalidate(planId, data[0]!.patient_id);
  return {};
}

const approveSchema = z.object({
  planId: z.uuid(),
  itemIds: z.array(z.uuid()).min(1, "Escolha pelo menos um item."),
  discountCents: z.number().int().min(0),
  installments: z.number().int().min(1).max(48),
  firstDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe o primeiro vencimento."),
  paymentMethodId: z.uuid().nullable(),
});

export async function approvePlan(input: z.input<typeof approveSchema>): Promise<Result> {
  const parsed = approveSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const { planId, itemIds, discountCents, installments, firstDueDate, paymentMethodId } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_treatment_plan", {
    _plan_id: planId,
    _item_ids: itemIds,
    _discount_cents: discountCents,
    _installments: installments,
    _first_due_date: firstDueDate,
    _payment_method_id: paymentMethodId as string,
  });
  if (error) return { error: planError(error) };
  revalidate(planId);
  revalidatePath("/financeiro");
  return {};
}

export async function setItemDone(itemId: string, done: boolean): Promise<Result> {
  if (!z.uuid().safeParse(itemId).success) return { error: "Item inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("treatment_items")
    .update({ status: done ? "done" : "approved" })
    .eq("id", itemId)
    .select("plan_id");
  if (error) return { error: error.code === "42501" ? "Só dentistas e a gestão marcam itens como realizados." : planError(error) };
  if (!data.length) return { error: "Item não encontrado." };
  revalidate(data[0]!.plan_id);
  return {};
}

function sessionError(error: PostgrestError): string {
  if (error.code === "42501") return "Só dentistas e a gestão registram sessões.";
  if (error.code === "OT010") return error.message;
  return planError(error);
}

/** Registra uma sessão feita do procedimento (no total, o item vira realizado). */
export async function registerItemSession(itemId: string): Promise<Result> {
  if (!z.uuid().safeParse(itemId).success) return { error: "Item inválido." };
  const session = await getSessionContext();
  if (!session?.clinic) return { error: "Sessão expirada. Entre novamente." };
  const supabase = await createClient();
  const { error } = await supabase.from("plan_item_sessions").insert({ clinic_id: session.clinic.id, plan_item_id: itemId, done_at: new Date().toISOString() });
  if (error) return { error: sessionError(error) };
  const { data } = await supabase.from("treatment_items").select("plan_id").eq("id", itemId).single();
  if (data) revalidate(data.plan_id);
  revalidatePath("/pacientes", "layout");
  return {};
}

/** Desfaz a última sessão feita (não volta o item: isso é o "realizado" de sempre). */
export async function undoItemSession(itemId: string): Promise<Result> {
  if (!z.uuid().safeParse(itemId).success) return { error: "Item inválido." };
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("plan_item_sessions")
    .select("id")
    .eq("plan_item_id", itemId)
    .not("done_at", "is", null)
    .order("done_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!last) return { error: "Nenhuma sessão para desfazer." };
  const { data, error } = await supabase.from("plan_item_sessions").delete().eq("id", last.id).select("id");
  if (error || !data.length) return { error: error ? sessionError(error) : "Só dentistas e a gestão desfazem sessões." };
  const { data: item } = await supabase.from("treatment_items").select("plan_id").eq("id", itemId).single();
  if (item) revalidate(item.plan_id);
  revalidatePath("/pacientes", "layout");
  return {};
}

/** Muda o total de sessões de um item já aprovado. */
export async function setItemSessions(itemId: string, sessions: number): Promise<Result> {
  const parsed = z.object({ itemId: z.uuid(), sessions: z.number().int().min(1).max(50) }).safeParse({ itemId, sessions });
  if (!parsed.success) return { error: "Entre 1 e 50 sessões." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("treatment_items").update({ sessions_planned: parsed.data.sessions }).eq("id", itemId).select("plan_id");
  if (error) return { error: planError(error) };
  if (!data.length) return { error: "Item não encontrado." };
  revalidate(data[0]!.plan_id);
  return {};
}
