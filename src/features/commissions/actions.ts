"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { subscriptionErrorMessage } from "@/lib/db-errors";
import { addMonths } from "@/lib/installments";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/features/tenancy/queries";
import { canManageClinic } from "@/features/tenancy/roles";

import { renderClosingPdf } from "./closing-pdf";
import { getStatement } from "./queries";

type Result = { error?: string; message?: string };

async function managerContext() {
  const session = await getSessionContext();
  if (!session?.clinic || !canManageClinic(session.clinic.role)) return null;
  return { session, clinicId: session.clinic.id, clinicName: session.clinic.name, supabase: await createClient() };
}

const err = (e: { code?: string; message?: string } | null, fallback: string) => subscriptionErrorMessage(e) ?? fallback;

export async function saveCommissionSettings(input: { base: "received" | "executed"; deductFees: boolean; deductLab: boolean }): Promise<Result> {
  const parsed = z.object({ base: z.enum(["received", "executed"]), deductFees: z.boolean(), deductLab: z.boolean() }).safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos." };
  const ctx = await managerContext();
  if (!ctx) return { error: "Só a gestão configura comissões." };
  const { error } = await ctx.supabase
    .from("clinics")
    .update({ commission_base: parsed.data.base, commission_deduct_fees: parsed.data.deductFees, commission_deduct_lab: parsed.data.deductLab })
    .eq("id", ctx.clinicId);
  if (error) return { error: err(error, "Não foi possível salvar.") };
  revalidatePath("/configuracoes/comissoes");
  return { message: "Configuração salva." };
}

export async function setDefaultPercent(professionalId: string, percent: number): Promise<Result> {
  if (!z.uuid().safeParse(professionalId).success || !(percent >= 0 && percent <= 100)) return { error: "Percentual entre 0 e 100." };
  const ctx = await managerContext();
  if (!ctx) return { error: "Sem permissão." };
  const { error } = await ctx.supabase.from("professionals").update({ commission_percent: percent }).eq("id", professionalId);
  if (error) return { error: err(error, "Não foi possível salvar.") };
  revalidatePath("/configuracoes/comissoes");
  return {};
}

const ruleSchema = z
  .object({
    professionalId: z.uuid(),
    procedureId: z.uuid().nullable(),
    category: z.string().trim().max(60).nullable(),
    percent: z.number().min(0).max(100).nullable(),
    fixedCents: z.number().int().min(0).nullable(),
  })
  .refine((r) => (r.procedureId === null) !== (r.category === null), "Escolha um procedimento ou uma categoria.")
  .refine((r) => (r.percent === null) !== (r.fixedCents === null), "Informe percentual ou valor fixo.")
  .refine((r) => r.fixedCents === null || r.procedureId !== null, "Valor fixo só vale para um procedimento.");

export async function addCommissionRule(input: z.input<typeof ruleSchema>): Promise<Result> {
  const parsed = ruleSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const ctx = await managerContext();
  if (!ctx) return { error: "Sem permissão." };
  const r = parsed.data;
  const { error } = await ctx.supabase.from("commission_rules").insert({
    clinic_id: ctx.clinicId,
    professional_id: r.professionalId,
    procedure_id: r.procedureId,
    category: r.category,
    percent: r.percent,
    fixed_cents: r.fixedCents,
  });
  if (error) return { error: error.code === "23505" ? "Já existe uma exceção para esse procedimento ou categoria." : err(error, "Não foi possível salvar.") };
  revalidatePath("/configuracoes/comissoes");
  return {};
}

export async function deleteCommissionRule(ruleId: string): Promise<Result> {
  if (!z.uuid().safeParse(ruleId).success) return { error: "Regra inválida." };
  const ctx = await managerContext();
  if (!ctx) return { error: "Sem permissão." };
  const { error } = await ctx.supabase.from("commission_rules").delete().eq("id", ruleId);
  if (error) return { error: err(error, "Não foi possível remover.") };
  revalidatePath("/configuracoes/comissoes");
  return {};
}

export async function setLabCost(itemId: string, cents: number): Promise<Result> {
  if (!z.uuid().safeParse(itemId).success || !Number.isInteger(cents) || cents < 0) return { error: "Valor inválido." };
  const ctx = await managerContext();
  if (!ctx) return { error: "Só a gestão informa o custo de laboratório." };
  const { data, error } = await ctx.supabase.from("treatment_items").update({ lab_cost_cents: cents }).eq("id", itemId).select("plan_id");
  if (error || !data.length) return { error: err(error, "Não foi possível salvar.") };
  revalidatePath(`/orcamentos/${data[0]!.plan_id}`);
  return { message: "Custo de laboratório salvo." };
}

/**
 * Fecha o mês do profissional: congela as linhas do extrato, lança a conta a
 * pagar do repasse (vence dia 5 do mês seguinte) e gera o PDF.
 */
export async function closeCommissionMonth(professionalId: string, month: string): Promise<Result> {
  if (!z.uuid().safeParse(professionalId).success || !/^\d{4}-\d{2}$/.test(month)) return { error: "Dados inválidos." };
  const ctx = await managerContext();
  if (!ctx) return { error: "Só a gestão fecha comissões." };
  if (!ctx.session.activeUnit) return { error: "Escolha uma unidade." };
  const data = await getStatement(professionalId, month);
  if (!data) return { error: "Profissional não encontrado." };
  if (data.closing) return { error: "Este mês já foi fechado para este profissional." };
  const { statement, professional, settings } = data;

  let payableId: string | null = null;
  if (statement.commissionCents > 0) {
    const { data: category } = await ctx.supabase.from("finance_categories").select("id").eq("type", "expense").eq("name", "Comissões").maybeSingle();
    const fallback = category ?? (await ctx.supabase.from("finance_categories").select("id").eq("type", "expense").order("name").limit(1).single()).data;
    if (!fallback) return { error: "Cadastre uma categoria de despesa para lançar o repasse." };
    const { data: payable, error } = await ctx.supabase
      .from("payables")
      .insert({
        clinic_id: ctx.clinicId,
        unit_id: ctx.session.activeUnit.id,
        category_id: fallback.id,
        description: `Comissão ${professional.name} — ${month.slice(5)}/${month.slice(0, 4)}`,
        amount_cents: statement.commissionCents,
        due_date: `${addMonths(`${month}-01`, 1).slice(0, 7)}-05`,
        created_by: ctx.session.user.id,
      })
      .select("id")
      .single();
    if (error) return { error: err(error, "Não foi possível lançar o repasse.") };
    payableId = payable.id;
  }

  const { data: closing, error } = await ctx.supabase
    .from("commission_closings")
    .insert({
      clinic_id: ctx.clinicId,
      professional_id: professionalId,
      period_month: `${month}-01`,
      base: settings.base,
      total_gross_cents: statement.grossCents,
      total_base_cents: statement.baseCents,
      total_commission_cents: statement.commissionCents,
      lines: statement.lines,
      payable_id: payableId,
      closed_by: ctx.session.user.id,
    })
    .select("id")
    .single();
  if (error) {
    if (payableId) await ctx.supabase.from("payables").update({ status: "canceled" }).eq("id", payableId);
    return { error: error.code === "23505" ? "Este mês já foi fechado." : err(error, "Não foi possível fechar.") };
  }

  const pdf = await renderClosingPdf({
    clinicName: ctx.clinicName,
    professionalName: professional.name,
    month,
    base: settings.base,
    lines: statement.lines,
    totals: { gross: statement.grossCents, base: statement.baseCents, commission: statement.commissionCents },
  });
  const path = `${ctx.clinicId}/finance/commissions/${closing.id}.pdf`;
  const admin = createAdminClient();
  const { error: upload } = await admin.storage.from("clinic").upload(path, pdf, { contentType: "application/pdf" });
  if (!upload) await admin.from("commission_closings").update({ pdf_path: path }).eq("id", closing.id);

  revalidatePath("/financeiro/comissoes");
  return { message: statement.commissionCents ? "Mês fechado e repasse lançado em contas a pagar." : "Mês fechado (sem comissão a pagar)." };
}
