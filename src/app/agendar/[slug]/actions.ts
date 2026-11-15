"use server";

import { z } from "zod";

import { confirmBooking, listSlots, requestBooking } from "@/features/booking/service";
import { normalizePhone } from "@/features/booking/slots";

/** Ações públicas (sem login): a página identifica a clínica pelo endereço. */
const slug = z.string().regex(/^[a-z0-9-]{3,60}$/);
const optionalId = z.uuid().nullable();

export async function getSlots(input: { slug: string; unitId: string; professionalId: string | null; procedureId: string | null; from: string }) {
  const parsed = z.object({ slug, unitId: z.uuid(), professionalId: optionalId, procedureId: optionalId, from: z.iso.date() }).safeParse(input);
  if (!parsed.success) return null;
  return listSlots(parsed.data.slug, parsed.data);
}

export async function startBooking(input: { slug: string; unitId: string; professionalId: string | null; procedureId: string | null; startsAt: string; name: string; phone: string }) {
  const parsed = z
    .object({ slug, unitId: z.uuid(), professionalId: optionalId, procedureId: optionalId, startsAt: z.iso.datetime(), name: z.string().trim().min(3, "Informe seu nome completo.").max(160), phone: z.string() })
    .safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Confira os dados." };
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return { error: "Telefone inválido. Use DDD + número." };
  return requestBooking(parsed.data.slug, { ...parsed.data, phone });
}

export async function finishBooking(input: { slug: string; requestId: string; code: string }) {
  const parsed = z.object({ slug, requestId: z.uuid(), code: z.string().regex(/^\d{6}$/, "O código tem 6 números.") }).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Código inválido." };
  return confirmBooking(parsed.data.slug, parsed.data.requestId, parsed.data.code);
}
