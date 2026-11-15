"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { formValues, type ActionState } from "@/lib/action-state";
import { subscriptionErrorMessage } from "@/lib/db-errors";
import { onlyDigits } from "@/lib/documents";
import { addMonths } from "@/lib/installments";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/features/tenancy/queries";
import { canManageClinic } from "@/features/tenancy/roles";

import { parseOfx } from "./ofx";

type Result = { error?: string; message?: string };

async function managerContext() {
  const session = await getSessionContext();
  if (!session?.clinic || !canManageClinic(session.clinic.role)) return null;
  return { session, clinicId: session.clinic.id, supabase: await createClient() };
}

const errorText = (error: { code?: string; message?: string } | null, fallback: string) =>
  subscriptionErrorMessage(error) ?? (error?.code?.startsWith("OF") || error?.code === "P0002" ? error.message! : fallback);

function revalidate() {
  revalidatePath("/financeiro", "layout");
}

const payableSchema = z.object({
  description: z.string().trim().min(2, "Descreva a conta.").max(200),
  supplierId: z.uuid().nullable(),
  categoryId: z.uuid({ message: "Escolha a categoria." }),
  costCenterId: z.uuid().nullable(),
  amountCents: z.number().int().positive("Informe o valor."),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe o vencimento."),
  /** "installments": divide o valor; "recurring": repete o valor todo mês (12 meses). */
  mode: z.enum(["single", "installments", "recurring"]),
  installments: z.number().int().min(1).max(48),
  paymentMethodId: z.uuid().nullable(),
  attachmentPath: z.string().max(300).nullable(),
  notes: z.string().trim().max(1000).nullable(),
});

export async function createPayable(input: z.input<typeof payableSchema>): Promise<Result> {
  const parsed = payableSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const ctx = await managerContext();
  if (!ctx) return { error: "Só a gestão lança contas a pagar." };
  if (!ctx.session.activeUnit) return { error: "Escolha uma unidade." };
  const d = parsed.data;
  if (d.attachmentPath && !d.attachmentPath.startsWith(`${ctx.clinicId}/finance/`)) return { error: "Anexo inválido." };

  const count = d.mode === "single" ? 1 : d.mode === "recurring" ? 12 : d.installments;
  const groupId = count > 1 ? randomUUID() : null;
  const base = d.mode === "installments" ? Math.floor(d.amountCents / count) : d.amountCents;
  const remainder = d.mode === "installments" ? d.amountCents - base * count : 0;
  const rows = Array.from({ length: count }, (_, i) => ({
    clinic_id: ctx.clinicId,
    unit_id: ctx.session.activeUnit!.id,
    supplier_id: d.supplierId,
    category_id: d.categoryId,
    cost_center_id: d.costCenterId,
    description: d.mode === "installments" && count > 1 ? `${d.description} (${i + 1}/${count})` : d.description,
    amount_cents: base + (i === 0 ? remainder : 0),
    due_date: addMonths(d.dueDate, i),
    installment_number: d.mode === "installments" ? i + 1 : 1,
    installment_total: d.mode === "installments" ? count : 1,
    group_id: groupId,
    recurring: d.mode === "recurring",
    payment_method_id: d.paymentMethodId,
    attachment_path: i === 0 ? d.attachmentPath : null,
    notes: d.notes,
    created_by: ctx.session.user.id,
  }));
  const { error } = await ctx.supabase.from("payables").insert(rows);
  if (error) return { error: errorText(error, "Não foi possível lançar a conta.") };
  revalidate();
  return { message: count > 1 ? `${count} contas lançadas.` : "Conta lançada." };
}

/** Caminho para o comprovante, que o navegador envia direto ao Storage. */
export async function prepareAttachment(fileName: string, size: number): Promise<{ path?: string; error?: string }> {
  const ctx = await managerContext();
  if (!ctx) return { error: "Sem permissão." };
  if (size > 10 * 1024 * 1024) return { error: "O comprovante pode ter até 10 MB." };
  const ext = (fileName.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
  return { path: `${ctx.clinicId}/finance/payables/${randomUUID()}${ext ? `.${ext}` : ""}` };
}

const paySchema = z.object({
  payableId: z.uuid(),
  paidAmountCents: z.number().int().positive(),
  paymentMethodId: z.uuid().nullable(),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function payPayable(input: z.input<typeof paySchema>): Promise<Result> {
  const parsed = paySchema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("pay_payable", {
    _payable_id: parsed.data.payableId,
    _paid_amount_cents: parsed.data.paidAmountCents,
    _payment_method_id: parsed.data.paymentMethodId as string,
    _paid_on: parsed.data.paidOn,
  });
  if (error) return { error: errorText(error, "Não foi possível dar baixa.") };
  revalidate();
  return {};
}

/** Cancela a conta; com includeFuture, também as próximas do mesmo grupo (recorrência/parcelas). */
export async function cancelPayable(payableId: string, includeFuture: boolean): Promise<Result> {
  if (!z.uuid().safeParse(payableId).success) return { error: "Conta inválida." };
  const ctx = await managerContext();
  if (!ctx) return { error: "Sem permissão." };
  const { data: p } = await ctx.supabase.from("payables").select("group_id, due_date").eq("id", payableId).maybeSingle();
  if (!p) return { error: "Conta não encontrada." };
  let query = ctx.supabase.from("payables").update({ status: "canceled" }).in("status", ["open", "overdue"]);
  query = includeFuture && p.group_id ? query.eq("group_id", p.group_id).gte("due_date", p.due_date) : query.eq("id", payableId);
  const { data, error } = await query.select("id");
  if (error) return { error: errorText(error, "Não foi possível cancelar.") };
  revalidate();
  return { message: `${data.length} ${data.length === 1 ? "conta cancelada" : "contas canceladas"}.` };
}

/** Importa um extrato OFX (texto). Linhas já importadas (mesmo FITID) são ignoradas. */
export async function importOfx(content: string): Promise<Result> {
  const ctx = await managerContext();
  if (!ctx) return { error: "Sem permissão." };
  if (content.length > 5_000_000) return { error: "Arquivo grande demais." };
  const { accountLabel, transactions } = parseOfx(content);
  if (!transactions.length) return { error: "Nenhum lançamento encontrado. Confira se o arquivo é OFX." };
  const { data, error } = await ctx.supabase
    .from("bank_transactions")
    .upsert(
      transactions.map((t) => ({
        clinic_id: ctx.clinicId,
        account_label: accountLabel,
        fitid: t.fitid,
        posted_on: t.postedOn,
        amount_cents: t.amountCents,
        description: t.description,
        imported_by: ctx.session.user.id,
      })),
      { onConflict: "clinic_id,account_label,fitid", ignoreDuplicates: true },
    )
    .select("id");
  if (error) return { error: errorText(error, "Não foi possível importar o extrato.") };
  revalidate();
  const added = data?.length ?? 0;
  return { message: `${added} ${added === 1 ? "lançamento importado" : "lançamentos importados"}${transactions.length > added ? ` (${transactions.length - added} já existiam)` : ""}.` };
}

export async function reconcile(input: { bankId: string; kind: "receivable" | "payable" | "ignore"; targetId?: string }): Promise<Result> {
  const parsed = z.object({ bankId: z.uuid(), kind: z.enum(["receivable", "payable", "ignore"]), targetId: z.uuid().optional() }).safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos." };
  const ctx = await managerContext();
  if (!ctx) return { error: "Sem permissão." };
  const { bankId, kind, targetId } = parsed.data;
  const changes =
    kind === "ignore"
      ? { status: "ignored" as const }
      : { status: "matched" as const, [kind === "receivable" ? "receivable_id" : "payable_id"]: targetId, matched_by: ctx.session.user.id, matched_at: new Date().toISOString() };
  const { error } = await ctx.supabase.from("bank_transactions").update(changes).eq("id", bankId);
  if (error) return { error: errorText(error, "Não foi possível conciliar.") };
  revalidate();
  return {};
}

// Cadastros ------------------------------------------------------------------------------

const opt = (max: number) => z.string().trim().max(max).transform((v) => v || null);
const checkbox = z.preprocess((v) => v === "on", z.boolean());
const optionalId = z.preprocess((v) => (v === "" ? undefined : v), z.uuid().optional());

async function saveSimple(table: "finance_categories" | "suppliers" | "cost_centers", values: Record<string, string>, row: Record<string, unknown>, id?: string): Promise<ActionState> {
  const ctx = await managerContext();
  if (!ctx) return { status: "error", message: "Só a gestão edita os cadastros.", values };
  const { error } = id
    ? await ctx.supabase.from(table).update(row as never).eq("id", id)
    : await ctx.supabase.from(table).insert({ ...row, clinic_id: ctx.clinicId } as never);
  if (error) return { status: "error", message: error.code === "23505" ? "Já existe um cadastro com esse nome." : errorText(error, "Não foi possível salvar."), values };
  revalidatePath("/configuracoes/financeiro");
  return { status: "success", message: "Salvo." };
}

export async function saveCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = z.object({ id: optionalId, type: z.enum(["income", "expense"]), name: z.string().trim().min(2, "Informe o nome.").max(80), active: checkbox }).safeParse(values);
  if (!parsed.success) return { status: "error", message: "Confira os campos.", fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  const { id, type, name, active } = parsed.data;
  return saveSimple("finance_categories", values, id ? { name, active } : { type, name, active }, id);
}

export async function saveSupplier(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = z
    .object({
      id: optionalId,
      name: z.string().trim().min(2, "Informe o nome.").max(160),
      document: z.string().transform(onlyDigits).refine((d) => d === "" || d.length === 11 || d.length === 14, "CPF ou CNPJ inválido.").transform((d) => d || null),
      phone: z.string().transform(onlyDigits).refine((d) => d === "" || /^\d{10,11}$/.test(d), "Telefone inválido.").transform((d) => d || null),
      email: opt(160),
      notes: opt(1000),
      active: checkbox,
    })
    .safeParse(values);
  if (!parsed.success) return { status: "error", message: "Confira os campos.", fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  const { id, ...row } = parsed.data;
  return saveSimple("suppliers", values, row, id);
}

export async function saveCostCenter(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = z.object({ id: optionalId, name: z.string().trim().min(2, "Informe o nome.").max(80), active: checkbox }).safeParse(values);
  if (!parsed.success) return { status: "error", message: "Confira os campos.", fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  const { id, ...row } = parsed.data;
  return saveSimple("cost_centers", values, row, id);
}
