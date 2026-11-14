"use server";

import { revalidatePath } from "next/cache";

import { formValues, type ActionState } from "@/lib/action-state";

import { dbErrorState, invalidState, managerContext, notFoundState } from "../action-utils";
import { procedureSchema } from "../schemas";

export async function saveProcedure(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = procedureSchema.safeParse(values);
  if (!parsed.success) return invalidState(parsed.error, values);

  const ctx = await managerContext();
  if (!ctx.ok) return ctx.state;

  const { id, name, code, category, price, durationMin, appliesToTooth, active } = parsed.data;
  const row = {
    name,
    code,
    category,
    price_cents: price,
    duration_min: durationMin,
    applies_to_tooth: appliesToTooth,
    active,
  };

  const { data, error } = id
    ? await ctx.supabase.from("procedures").update(row).eq("id", id).select("id")
    : await ctx.supabase.from("procedures").insert({ ...row, clinic_id: ctx.clinicId }).select("id");
  if (error) return dbErrorState(error, values);
  if (!data.length) return notFoundState;

  revalidatePath("/configuracoes/procedimentos");
  return { status: "success", message: id ? "Procedimento salvo." : "Procedimento criado." };
}
