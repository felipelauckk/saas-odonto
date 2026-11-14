"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/features/tenancy/queries";
import { canManageClinic } from "@/features/tenancy/roles";

import { sendAppointmentReminder } from "./service";

type Result = { error?: string; message?: string };

const templateSchema = z.object({
  id: z.uuid(),
  body: z.string().trim().min(5, "Escreva a mensagem.").max(1000, "Mensagem muito longa."),
  active: z.boolean(),
});

export async function saveMessageTemplate(input: z.input<typeof templateSchema>): Promise<Result> {
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const session = await getSessionContext();
  if (!session?.clinic || !canManageClinic(session.clinic.role)) return { error: "Você não tem permissão para alterar as mensagens." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("message_templates")
    .update({ body: parsed.data.body, active: parsed.data.active })
    .eq("id", parsed.data.id)
    .select("id");
  if (error || !data.length) return { error: "Não foi possível salvar." };
  revalidatePath("/configuracoes/mensagens");
  return { message: "Mensagem salva." };
}

/** "Enviar lembrete agora" na agenda. A consulta é lida com a sessão do usuário (RLS) antes do envio. */
export async function sendReminderNow(appointmentId: string): Promise<Result> {
  if (!z.uuid().safeParse(appointmentId).success) return { error: "Consulta inválida." };
  const session = await getSessionContext();
  if (!session?.clinic || session.clinic.role === "dentist") return { error: "Só a recepção e a gestão enviam lembretes." };
  const supabase = await createClient();
  const { data } = await supabase.from("appointments").select("id, status").eq("id", appointmentId).maybeSingle();
  if (!data) return { error: "Consulta não encontrada." };
  if (data.status === "canceled" || data.status === "no_show") return { error: "Esta consulta foi cancelada ou teve falta." };

  const result = await sendAppointmentReminder(appointmentId);
  revalidatePath("/configuracoes/mensagens");
  if (result.status === "failed") return { error: result.error ?? "Não foi possível enviar. Veja o motivo em Configurações → Mensagens." };
  return { message: result.status === "simulated" ? "Lembrete registrado (envio simulado: WhatsApp não configurado)." : "Lembrete enviado." };
}
