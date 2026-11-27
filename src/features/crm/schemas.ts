import { z } from "zod";

import { onlyDigits } from "@/lib/documents";


const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Até ${max} caracteres.`)
    .optional()
    .transform((v) => v || null);

const optionalUuid = z
  .string()
  .optional()
  .transform((v) => (v && v !== "none" ? v : null))
  .pipe(z.uuid().nullable());

export const phoneField = z
  .string()
  .optional()
  .transform((v) => onlyDigits(v ?? ""))
  .refine((d) => d === "" || /^\d{10,11}$/.test(d), "Telefone com DDD, ex.: (11) 98888-7777.")
  .transform((d) => d || null);

export const leadSchema = z
  .object({
    id: z.string().optional().transform((v) => v || undefined).pipe(z.uuid().optional()),
    name: z.string().trim().min(2, "Informe o nome.").max(160),
    phone: phoneField,
    email: optionalText(160).refine((v) => v === null || z.email().safeParse(v).success, "E-mail inválido."),
    sourceId: optionalUuid,
    campaignId: optionalUuid,
    procedureId: optionalUuid,
    interest: optionalText(160),
    notes: optionalText(1000),
    stageId: optionalUuid,
    referral: z
      .string()
      .optional()
      .transform((v) => v ?? "")
      .refine((v) => v === "" || v === "none" || /^(patient|partner):[0-9a-f-]{36}$/i.test(v), "Indicação inválida."),
  })
  .refine((d) => d.phone || d.email, { message: "Informe telefone ou e-mail.", path: ["phone"] });

/** "patient:<id>" | "partner:<id>" → colunas de indicação. */
export function referralColumns(value: string) {
  const [kind, id] = value.split(":");
  return {
    referred_by_patient_id: kind === "patient" ? (id ?? null) : null,
    referred_by_partner_id: kind === "partner" ? (id ?? null) : null,
  };
}

export const publicLeadSchema = z.object({
  token: z.string().regex(/^[0-9a-f]{32}$/),
  name: z.string().trim().min(2, "Informe seu nome.").max(160),
  phone: phoneField.refine((v) => v !== null, "Informe seu telefone com DDD."),
  interest: optionalText(160),
  message: optionalText(1000),
  /** Chave da origem na lista (instagram, site...); desconhecida vira "site". */
  source: z.string().regex(/^[a-z_]{2,20}$/).catch("site"),
  campaignId: z.uuid().nullable().catch(null),
  website: z.string().max(0).optional(), // armadilha para robôs
  startedAt: z.coerce.number(),
});
