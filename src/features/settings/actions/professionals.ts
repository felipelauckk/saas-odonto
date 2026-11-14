"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { formValues, type ActionState } from "@/lib/action-state";

import { dbErrorState, invalidState, managerContext, notFoundState } from "../action-utils";
import { professionalSchema, scheduleSchema } from "../schemas";

export async function saveProfessional(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = professionalSchema.safeParse(values);
  if (!parsed.success) return invalidState(parsed.error, values);

  const ctx = await managerContext();
  if (!ctx.ok) return ctx.state;

  const { id, name, cro, specialty, color, memberId, active } = parsed.data;
  const row = { name, cro, specialty, color, member_id: memberId, active };

  const { data, error } = id
    ? await ctx.supabase.from("professionals").update(row).eq("id", id).select("id")
    : await ctx.supabase.from("professionals").insert({ ...row, clinic_id: ctx.clinicId }).select("id");

  if (error?.code === "23505") {
    return { status: "error", message: "Este membro da equipe já está ligado a outro profissional.", values };
  }
  if (error) return dbErrorState(error, values);
  if (!data.length) return notFoundState;

  revalidatePath("/configuracoes/profissionais");
  // Profissional novo: vai direto para a tela de horários.
  if (!id) redirect(`/configuracoes/profissionais/${data[0]!.id}`);
  revalidatePath(`/configuracoes/profissionais/${id}`);
  return { status: "success", message: "Profissional salvo." };
}

export async function saveSchedule(input: z.input<typeof scheduleSchema>): Promise<{ error?: string }> {
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Horários inválidos." };
  }

  const ctx = await managerContext();
  if (!ctx.ok) return { error: ctx.state.message };

  const { professionalId, entries } = parsed.data;
  const { error } = await ctx.supabase.rpc("replace_professional_schedule", {
    _professional_id: professionalId,
    _entries: entries.map((e) => ({
      unit_id: e.unitId,
      weekday: e.weekday,
      start_time: e.start,
      end_time: e.end,
    })),
  });
  if (error) return { error: dbErrorState(error).message };

  revalidatePath(`/configuracoes/profissionais/${professionalId}`);
  return {};
}
