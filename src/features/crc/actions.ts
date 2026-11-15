"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionContext } from "@/features/tenancy/queries";
import { subscriptionErrorMessage } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";

import { crcQueues } from "./labels";

type Result = { error?: string };

const contactSchema = z.object({
  queue: z.enum(crcQueues as [string, ...string[]]),
  itemKey: z.string().min(1).max(120),
  patientId: z.uuid(),
  refId: z.uuid().nullable(),
  amountCents: z.number().int().min(0).nullable(),
  channel: z.enum(["call", "whatsapp", "other"]),
  outcome: z.enum(["no_answer", "thinking", "scheduled", "not_interested"]).nullable(),
  notes: z.string().trim().max(500).optional(),
  nextContactOn: z.iso.date().nullable().optional(),
});

export type ContactInput = z.input<typeof contactSchema>;

export async function logContact(input: ContactInput): Promise<Result> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const session = await getSessionContext();
  if (!session?.clinic) return { error: "Sessão expirada." };
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("crc_contacts").insert({
    clinic_id: session.clinic.id,
    patient_id: d.patientId,
    queue: d.queue as (typeof crcQueues)[number],
    item_key: d.itemKey,
    ref_id: d.refId,
    amount_cents: d.amountCents,
    channel: d.channel,
    outcome: d.outcome,
    notes: d.notes || null,
    next_contact_on: d.nextContactOn ?? null,
    created_by: session.user.id,
  });
  if (error) return { error: subscriptionErrorMessage(error) ?? "Não foi possível registrar o contato." };
  revalidatePath("/crc");
  return {};
}

export async function saveCrcTemplate(queue: string, body: string): Promise<Result> {
  const parsed = z.object({ queue: z.enum(crcQueues as [string, ...string[]]), body: z.string().trim().min(1, "Escreva a mensagem.").max(1000) }).safeParse({ queue, body });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crc_templates")
    .update({ body: parsed.data.body })
    .eq("queue", parsed.data.queue as (typeof crcQueues)[number])
    .select("id");
  if (error) return { error: subscriptionErrorMessage(error) ?? "Não foi possível salvar." };
  if (!data.length) return { error: "Sem permissão para editar." };
  revalidatePath("/configuracoes/mensagens");
  return {};
}
