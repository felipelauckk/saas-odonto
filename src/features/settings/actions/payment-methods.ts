"use server";

import { revalidatePath } from "next/cache";

import { formValues, type ActionState } from "@/lib/action-state";

import { dbErrorState, invalidState, managerContext, notFoundState } from "../action-utils";
import { paymentMethodSchema } from "../schemas";

export async function savePaymentMethod(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = paymentMethodSchema.safeParse(values);
  if (!parsed.success) return invalidState(parsed.error, values);

  const ctx = await managerContext();
  if (!ctx.ok) return ctx.state;

  const { id, name, feePercent, daysToReceive, active } = parsed.data;
  const row = { name, fee_percent: feePercent, days_to_receive: daysToReceive, active };

  const { data, error } = id
    ? await ctx.supabase.from("payment_methods").update(row).eq("id", id).select("id")
    : await ctx.supabase.from("payment_methods").insert({ ...row, clinic_id: ctx.clinicId }).select("id");
  if (error) return dbErrorState(error, values);
  if (!data.length) return notFoundState;

  revalidatePath("/configuracoes/formas-de-pagamento");
  return { status: "success", message: id ? "Forma de pagamento salva." : "Forma de pagamento criada." };
}
