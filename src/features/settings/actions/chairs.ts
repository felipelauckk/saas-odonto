"use server";

import { revalidatePath } from "next/cache";

import { formValues, type ActionState } from "@/lib/action-state";

import { dbErrorState, invalidState, managerContext, notFoundState } from "../action-utils";
import { chairSchema } from "../schemas";

export async function saveChair(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = chairSchema.safeParse(values);
  if (!parsed.success) return invalidState(parsed.error, values);

  const ctx = await managerContext();
  if (!ctx.ok) return ctx.state;

  const { id, unitId, name, active } = parsed.data;
  // A unidade de uma cadeira não muda depois de criada (a agenda depende disso).
  const { data, error } = id
    ? await ctx.supabase.from("chairs").update({ name, active }).eq("id", id).select("id")
    : await ctx.supabase
        .from("chairs")
        .insert({ clinic_id: ctx.clinicId, unit_id: unitId, name, active })
        .select("id");
  if (error) return dbErrorState(error, values);
  if (!data.length) return notFoundState;

  revalidatePath("/configuracoes/cadeiras");
  return { status: "success", message: id ? "Cadeira salva." : "Cadeira criada." };
}
