"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionContext } from "@/features/tenancy/queries";
import { subscriptionErrorMessage } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";

import { fieldsSchema, sanitizeData, type Field } from "./fields";

type Result = { error?: string };

/** Nova versão da ficha (cópia do modelo atual + respostas limpas). */
export async function saveSpecialtyRecord(input: { patientId: string; templateId: string; data: Record<string, unknown> }): Promise<Result> {
  const parsed = z.object({ patientId: z.uuid(), templateId: z.uuid(), data: z.record(z.string(), z.unknown()) }).safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos." };
  const session = await getSessionContext();
  if (!session?.clinic) return { error: "Sessão expirada." };
  const supabase = await createClient();
  const { data: template } = await supabase.from("specialty_templates").select("name, fields").eq("id", parsed.data.templateId).maybeSingle();
  if (!template) return { error: "Ficha não encontrada." };
  const fields = template.fields as Field[];
  const data = sanitizeData(fields, parsed.data.data);
  if (!Object.keys(data).length) return { error: "Preencha pelo menos um campo." };
  const { data: own } = await supabase.rpc("current_professional_ids");
  const { error } = await supabase.from("specialty_records").insert({
    clinic_id: session.clinic.id,
    patient_id: parsed.data.patientId,
    template_id: parsed.data.templateId,
    template_name: template.name,
    fields,
    data,
    professional_id: ((own as string[] | null) ?? [])[0] ?? null,
    filled_by: session.user.id,
  });
  if (error) return { error: error.code === "42501" ? "Só quem atende pode registrar no prontuário." : (subscriptionErrorMessage(error) ?? "Não foi possível salvar a ficha.") };
  revalidatePath(`/pacientes/${parsed.data.patientId}/fichas`);
  return {};
}

export async function saveTemplate(input: { id?: string; name: string; specialty: string; fields: Field[]; active: boolean }): Promise<Result & { id?: string }> {
  const parsed = z
    .object({
      id: z.uuid().optional(),
      name: z.string().trim().min(2, "Informe o nome.").max(80),
      specialty: z.enum(["ortho", "implant", "endo", "perio", "hof", "other"]),
      fields: fieldsSchema,
      active: z.boolean(),
    })
    .safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os campos." };
  const session = await getSessionContext();
  if (!session?.clinic) return { error: "Sessão expirada." };
  const supabase = await createClient();
  const { id, name, specialty, fields, active } = parsed.data;
  const { data, error } = id
    ? await supabase.from("specialty_templates").update({ name, fields, active }).eq("id", id).select("id")
    : await supabase.from("specialty_templates").insert({ clinic_id: session.clinic.id, name, specialty, fields, active }).select("id");
  if (error || !data?.length) return { error: error ? (subscriptionErrorMessage(error) ?? "Não foi possível salvar.") : "Sem permissão." };
  revalidatePath("/configuracoes/fichas", "layout");
  return { id: data[0]!.id };
}

export async function toggleProfessionalForm(professionalId: string, templateId: string, on: boolean): Promise<Result> {
  if (!z.uuid().safeParse(professionalId).success || !z.uuid().safeParse(templateId).success) return { error: "Dados inválidos." };
  const session = await getSessionContext();
  if (!session?.clinic) return { error: "Sessão expirada." };
  const supabase = await createClient();
  const { error } = on
    ? await supabase.from("professional_specialty_forms").insert({ clinic_id: session.clinic.id, professional_id: professionalId, template_id: templateId })
    : await supabase.from("professional_specialty_forms").delete().eq("professional_id", professionalId).eq("template_id", templateId);
  if (error && error.code !== "23505") return { error: "Sem permissão." };
  revalidatePath("/configuracoes/fichas");
  return {};
}
