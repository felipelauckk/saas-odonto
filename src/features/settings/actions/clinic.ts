"use server";

import { revalidatePath } from "next/cache";

import { formValues, type ActionState } from "@/lib/action-state";

import { dbErrorState, invalidState, managerContext, notFoundState } from "../action-utils";
import { clinicSchema } from "../schemas";

const LOGO_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const LOGO_MAX_BYTES = 1024 * 1024;

export async function updateClinic(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = clinicSchema.safeParse(values);
  if (!parsed.success) return invalidState(parsed.error, values);

  const ctx = await managerContext();
  if (!ctx.ok) return ctx.state;

  const { name, legalName, document, phone, email } = parsed.data;
  const { data, error } = await ctx.supabase
    .from("clinics")
    .update({ name, legal_name: legalName, document_cnpj_cpf: document, phone, email })
    .eq("id", ctx.clinicId)
    .select("id");
  if (error) return dbErrorState(error, values);
  if (!data.length) return notFoundState;

  revalidatePath("/", "layout");
  return { status: "success", message: "Dados da clínica salvos." };
}

export async function uploadLogo(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return { status: "error", message: "Escolha uma imagem." };
  const ext = LOGO_TYPES[file.type];
  if (!ext) return { status: "error", message: "Use uma imagem PNG, JPG ou WebP." };
  if (file.size > LOGO_MAX_BYTES) return { status: "error", message: "A imagem pode ter no máximo 1 MB." };

  const ctx = await managerContext();
  if (!ctx.ok) return ctx.state;

  const { data: clinic } = await ctx.supabase.from("clinics").select("logo_url").eq("id", ctx.clinicId).single();
  const path = `${ctx.clinicId}/logo/logo-${Date.now()}.${ext}`;

  const { error: uploadError } = await ctx.supabase.storage
    .from("clinic")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return { status: "error", message: "Não foi possível enviar a imagem. Tente novamente." };

  const { error } = await ctx.supabase.from("clinics").update({ logo_url: path }).eq("id", ctx.clinicId);
  if (error) {
    await ctx.supabase.storage.from("clinic").remove([path]);
    return dbErrorState(error);
  }
  if (clinic?.logo_url) await ctx.supabase.storage.from("clinic").remove([clinic.logo_url]);

  revalidatePath("/configuracoes/clinica");
  return { status: "success", message: "Logo atualizado." };
}

export async function removeLogo(): Promise<{ error?: string }> {
  const ctx = await managerContext();
  if (!ctx.ok) return { error: ctx.state.message };

  const { data: clinic } = await ctx.supabase.from("clinics").select("logo_url").eq("id", ctx.clinicId).single();
  const { error } = await ctx.supabase.from("clinics").update({ logo_url: null }).eq("id", ctx.clinicId);
  if (error) return { error: "Não foi possível remover o logo." };
  if (clinic?.logo_url) await ctx.supabase.storage.from("clinic").remove([clinic.logo_url]);

  revalidatePath("/configuracoes/clinica");
  return {};
}
