"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { formValues, type ActionState } from "@/lib/action-state";

import { dbErrorState, invalidState, managerContext, notFoundState } from "../action-utils";

const tagSchema = z.object({
  id: z.uuid().optional().or(z.literal("").transform(() => undefined)),
  name: z.string().trim().min(1, "Informe o nome.").max(40, "Até 40 caracteres."),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida."),
  active: z.string().optional().transform((v) => v === "on"),
});

export async function saveTag(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = tagSchema.safeParse(values);
  if (!parsed.success) return invalidState(parsed.error, values);
  const ctx = await managerContext();
  if (!ctx.ok) return ctx.state;
  const { id, ...row } = parsed.data;
  const { data, error } = id
    ? await ctx.supabase.from("appointment_tags").update(row).eq("id", id).select("id")
    : await ctx.supabase.from("appointment_tags").insert({ ...row, clinic_id: ctx.clinicId }).select("id");
  if (error) {
    if (error.code === "23505") return { status: "error", message: "Já existe um marcador com esse nome.", values };
    return dbErrorState(error, values);
  }
  if (!data.length) return notFoundState;
  revalidatePath("/configuracoes/marcadores");
  revalidatePath("/agenda");
  return { status: "success", message: id ? "Marcador salvo." : "Marcador criado." };
}
