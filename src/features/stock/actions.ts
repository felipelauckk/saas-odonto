"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionContext } from "@/features/tenancy/queries";
import { formValues, type ActionState } from "@/lib/action-state";
import { subscriptionErrorMessage } from "@/lib/db-errors";
import { parseBRLToCents, parseDecimal } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

type Result = { error?: string };

async function context() {
  const session = await getSessionContext();
  if (!session?.clinic) return null;
  return { session, clinicId: session.clinic.id, supabase: await createClient() };
}

function stockError(error: { code?: string; message?: string }, fallback: string) {
  if (error.code?.startsWith("OE") || error.code === "42501") return error.message ?? fallback;
  return subscriptionErrorMessage(error) ?? fallback;
}

function refresh() {
  revalidatePath("/estoque", "layout");
}

const qty = z.string().transform((v, c) => {
  const n = parseDecimal(v);
  if (n === null || n <= 0) {
    c.addIssue({ code: "custom", message: "Quantidade inválida." });
    return z.NEVER;
  }
  return n;
});

export async function saveProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = z
    .object({
      id: z.string().optional().transform((v) => v || undefined).pipe(z.uuid().optional()),
      name: z.string().trim().min(2, "Informe o nome.").max(120),
      measure: z.string().trim().min(1, "Informe a unidade.").max(12),
      category: z.string().trim().max(60).transform((v) => v || null),
      minQty: z.string().transform((v, c) => {
        const n = parseDecimal(v.trim() || "0");
        if (n === null || n < 0) {
          c.addIssue({ code: "custom", message: "Valor inválido." });
          return z.NEVER;
        }
        return n;
      }),
      active: z.string().optional().transform((v) => v === "on"),
    })
    .safeParse({ category: "", minQty: "", ...values });
  if (!parsed.success) return { status: "error", message: "Confira os campos.", fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  const ctx = await context();
  if (!ctx) return { status: "error", message: "Sessão expirada.", values };
  const { id, name, measure, category, minQty, active } = parsed.data;
  const row = { name, measure, category, min_qty: minQty, active };
  const { data, error } = id
    ? await ctx.supabase.from("stock_products").update(row).eq("id", id).select("id")
    : await ctx.supabase.from("stock_products").insert({ ...row, clinic_id: ctx.clinicId }).select("id");
  if (error) return { status: "error", message: error.code === "23505" ? "Já existe um produto com esse nome." : stockError(error, "Não foi possível salvar."), values };
  if (!data.length) return { status: "error", message: "Sem permissão.", values };
  refresh();
  return { status: "success", message: "Produto salvo." };
}

export async function stockPurchase(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = z
    .object({
      unitId: z.uuid(),
      productId: z.uuid({ message: "Escolha o produto." }),
      qty,
      unitCost: z.string().transform((v, c) => {
        const cents = parseBRLToCents(v.trim() || "0");
        if (cents === null) {
          c.addIssue({ code: "custom", message: "Custo inválido." });
          return z.NEVER;
        }
        return cents;
      }),
      lotCode: z.string().trim().max(40),
      expiresOn: z.string().transform((v) => v || null).pipe(z.iso.date().nullable()),
      supplierId: z.string().transform((v) => (v && v !== "none" ? v : null)).pipe(z.uuid().nullable()),
      createPayable: z.string().optional().transform((v) => v === "on"),
      dueDate: z.string().transform((v) => v || null).pipe(z.iso.date().nullable()),
    })
    .safeParse({ lotCode: "", expiresOn: "", supplierId: "", dueDate: "", unitCost: "", ...values });
  if (!parsed.success) return { status: "error", message: "Confira os campos.", fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  const ctx = await context();
  if (!ctx) return { status: "error", message: "Sessão expirada.", values };
  const d = parsed.data;
  const { error } = await ctx.supabase.rpc("stock_purchase", {
    _unit_id: d.unitId,
    _product_id: d.productId,
    _qty: d.qty,
    _unit_cost_cents: d.unitCost,
    _lot_code: d.lotCode,
    _expires_on: d.expiresOn as string,
    _supplier_id: d.supplierId as string,
    _create_payable: d.createPayable,
    _due_date: d.dueDate as string,
  });
  if (error) return { status: "error", message: stockError(error, "Não foi possível registrar a entrada."), values };
  refresh();
  if (d.createPayable) revalidatePath("/financeiro/pagar");
  return { status: "success", message: "Entrada registrada." };
}

export async function stockOut(input: { unitId: string; productId: string; qty: string; note: string }): Promise<Result> {
  const parsed = z.object({ unitId: z.uuid(), productId: z.uuid({ message: "Escolha o produto." }), qty, note: z.string().trim().max(300) }).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const ctx = await context();
  if (!ctx) return { error: "Sessão expirada." };
  const { error } = await ctx.supabase.rpc("stock_out", { _unit_id: parsed.data.unitId, _product_id: parsed.data.productId, _qty: parsed.data.qty, _note: parsed.data.note });
  if (error) return { error: stockError(error, "Não foi possível registrar a saída.") };
  refresh();
  return {};
}

export async function stockTransfer(input: { fromUnit: string; toUnit: string; productId: string; qty: string }): Promise<Result> {
  const parsed = z.object({ fromUnit: z.uuid(), toUnit: z.uuid({ message: "Escolha a unidade de destino." }), productId: z.uuid({ message: "Escolha o produto." }), qty }).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const ctx = await context();
  if (!ctx) return { error: "Sessão expirada." };
  const { error } = await ctx.supabase.rpc("stock_transfer", { _from_unit: parsed.data.fromUnit, _to_unit: parsed.data.toUnit, _product_id: parsed.data.productId, _qty: parsed.data.qty });
  if (error) return { error: stockError(error, "Não foi possível transferir.") };
  refresh();
  return {};
}

export async function saveKitItem(input: { procedureId: string; productId: string; qty: string }): Promise<Result> {
  const parsed = z.object({ procedureId: z.uuid(), productId: z.uuid({ message: "Escolha o produto." }), qty }).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const ctx = await context();
  if (!ctx) return { error: "Sessão expirada." };
  const { error } = await ctx.supabase
    .from("procedure_kits")
    .upsert({ clinic_id: ctx.clinicId, procedure_id: parsed.data.procedureId, product_id: parsed.data.productId, qty: parsed.data.qty }, { onConflict: "procedure_id,product_id" });
  if (error) return { error: stockError(error, "Só a gestão monta os kits.") };
  refresh();
  return {};
}

export async function removeKitItem(id: string): Promise<Result> {
  const ctx = await context();
  if (!ctx) return { error: "Sessão expirada." };
  const { error } = await ctx.supabase.from("procedure_kits").delete().eq("id", id);
  if (error) return { error: "Não foi possível remover." };
  refresh();
  return {};
}
