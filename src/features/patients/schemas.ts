import { z } from "zod";

import { ageFromBirthDate, todayIso } from "@/lib/dates";
import { isValidCpf, onlyDigits } from "@/lib/documents";

import { patientGenders, patientSources } from "./labels";

const text = z.preprocess((v) => (typeof v === "string" ? v : ""), z.string().trim());
const optionalText = (max: number) =>
  text.pipe(z.string().max(max, "Texto muito longo.")).transform((v) => v || null);

const optionalCpf = (message: string) =>
  text
    .transform(onlyDigits)
    .refine((d) => d === "" || isValidCpf(d), message)
    .transform((d) => d || null);

const optionalPhone = text
  .transform(onlyDigits)
  .refine((d) => d === "" || /^[1-9]{2}9?\d{8}$/.test(d), "Telefone inválido. Use DDD + número.")
  .transform((d) => d || null);

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess((v) => (v === "" || v === "none" || v == null ? null : v), z.enum(values).nullable());

export const MINOR_AGE = 18;

export const patientSchema = z
  .object({
    id: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.uuid().optional()),
    fullName: text.pipe(z.string().min(3, "Informe o nome completo.").max(160, "Nome muito longo.")),
    cpf: optionalCpf("CPF inválido."),
    birthDate: text
      .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data inválida.")
      .refine((v) => v === "" || (v >= "1900-01-01" && v <= todayIso()), "Data de nascimento inválida.")
      .transform((v) => v || null),
    gender: optionalEnum(patientGenders),
    phone: optionalPhone,
    whatsappSameAsPhone: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
    whatsapp: optionalPhone,
    email: text
      .refine((v) => v === "" || z.email().safeParse(v).success, "E-mail inválido.")
      .transform((v) => v.toLowerCase() || null),
    cep: text
      .transform(onlyDigits)
      .refine((d) => d === "" || d.length === 8, "CEP inválido.")
      .transform((d) => d || null),
    street: optionalText(200),
    number: optionalText(20),
    complement: optionalText(100),
    district: optionalText(100),
    city: optionalText(100),
    state: text
      .transform((v) => v.toUpperCase())
      .refine((v) => v === "" || /^[A-Z]{2}$/.test(v), "Use a sigla do estado, ex.: SP.")
      .transform((v) => v || null),
    source: optionalEnum(patientSources),
    notes: optionalText(2000),
    guardianName: optionalText(160),
    guardianCpf: optionalCpf("CPF do responsável inválido."),
    consentLgpd: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  })
  .superRefine((data, ctx) => {
    const minor = data.birthDate !== null && ageFromBirthDate(data.birthDate) < MINOR_AGE;
    if (minor && !data.guardianName) {
      ctx.addIssue({ code: "custom", message: "Paciente menor de idade: informe o responsável.", path: ["guardianName"] });
    }
  })
  .transform(({ whatsappSameAsPhone, ...data }) => ({
    ...data,
    whatsapp: whatsappSameAsPhone ? data.phone : data.whatsapp,
  }));

export type PatientInput = z.output<typeof patientSchema>;

export const patientFiltersSchema = z.object({
  q: z.string().trim().max(100).catch(""),
  status: z.enum(["active", "archived"]).catch("active"),
  source: z.enum(patientSources).nullable().catch(null),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
