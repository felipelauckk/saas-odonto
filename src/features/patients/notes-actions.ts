"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { subscriptionErrorMessage } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";

type Result = { error?: string };

const noteSchema = z.object({
  patientId: z.uuid(),
  body: z.string().trim().min(1, "Escreva a nota.").max(2000, "No máximo 2.000 caracteres."),
  pinned: z.boolean().default(false),
});

/** Nota geral do paciente (não é prontuário): todo membro escreve. */
export async function addPatientNote(input: z.input<typeof noteSchema>): Promise<Result> {
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira a nota." };
  const supabase = await createClient();
  const { data: clinicId } = await supabase.rpc("current_clinic_id");
  if (!clinicId) return { error: "Sessão expirada. Entre de novo." };
  const { error } = await supabase
    .from("patient_notes")
    .insert({ clinic_id: clinicId, patient_id: parsed.data.patientId, body: parsed.data.body, pinned: parsed.data.pinned });
  if (error) return { error: subscriptionErrorMessage(error) ?? "Não foi possível salvar a nota." };
  revalidatePath(`/pacientes/${parsed.data.patientId}`);
  return {};
}

/** Fixa ou desafixa (autor ou gestão; a RLS confere). */
export async function setPatientNotePinned(id: string, patientId: string, pinned: boolean): Promise<Result> {
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(patientId).success) return { error: "Nota inválida." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("patient_notes").update({ pinned }).eq("id", id).select("id");
  if (error) return { error: subscriptionErrorMessage(error) ?? "Não foi possível alterar a nota." };
  if (!data.length) return { error: "Só quem escreveu a nota ou a gestão pode mudar." };
  revalidatePath(`/pacientes/${patientId}`);
  return {};
}

/** Apaga (autor ou gestão; a RLS confere). */
export async function deletePatientNote(id: string, patientId: string): Promise<Result> {
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(patientId).success) return { error: "Nota inválida." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("patient_notes").delete().eq("id", id).select("id");
  if (error) return { error: subscriptionErrorMessage(error) ?? "Não foi possível apagar a nota." };
  if (!data.length) return { error: "Só quem escreveu a nota ou a gestão pode apagar." };
  revalidatePath(`/pacientes/${patientId}`);
  return {};
}
