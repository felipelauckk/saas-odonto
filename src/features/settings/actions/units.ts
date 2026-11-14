"use server";

import { revalidatePath } from "next/cache";

import { formValues, type ActionState } from "@/lib/action-state";

import { dbErrorState, invalidState, managerContext, notFoundState } from "../action-utils";
import { unitSchema } from "../schemas";

export async function saveUnit(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = unitSchema.safeParse(values);
  if (!parsed.success) return invalidState(parsed.error, values);

  const ctx = await managerContext();
  if (!ctx.ok) return ctx.state;

  const { id, name, phone, active, cep, street, number, complement, district, city, state } = parsed.data;
  const address = { cep, street, number, complement, district, city, state };
  const row = { name, phone, address, active };

  if (id && !active) {
    // A clínica precisa de pelo menos uma unidade ativa.
    const { count } = await ctx.supabase
      .from("units")
      .select("id", { count: "exact", head: true })
      .eq("active", true)
      .neq("id", id);
    if (!count) return { status: "error", message: "A clínica precisa ter pelo menos uma unidade ativa.", values };
  }

  const { data, error } = id
    ? await ctx.supabase.from("units").update(row).eq("id", id).select("id")
    : await ctx.supabase.from("units").insert({ ...row, clinic_id: ctx.clinicId }).select("id");
  if (error) return dbErrorState(error, values);
  if (!data.length) return notFoundState;

  revalidatePath("/", "layout");
  return { status: "success", message: id ? "Unidade salva." : "Unidade criada." };
}
