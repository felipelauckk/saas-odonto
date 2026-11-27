import { z } from "zod";

import { ageFromBirthDate, todayIso } from "@/lib/dates";
import { isValidCpf, onlyDigits } from "@/lib/documents";

import { patientGenders } from "./labels";

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

export const maritalStatuses = ["solteiro", "casado", "uniao_estavel", "divorciado", "viuvo"] as const;
export const educationLevels = ["fundamental", "medio", "superior", "pos", "nao_informado"] as const;

const optionalDate = (message: string) =>
  text
    .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Data inválida.")
    .refine((v) => v === "" || (v >= "1900-01-01" && v <= todayIso()), message)
    .transform((v) => v || null);

const optionalUuid = z.preprocess((v) => (v === "" || v === "none" || v == null ? null : v), z.uuid().nullable());

/** Usuário de rede social: sem @ e sem endereço. */
const handle = (max: number, pattern: RegExp, message: string) =>
  text
    .transform((v) => v.replace(/^@/, "").replace(/^https?:\/\/(www\.)?(instagram|facebook)\.com\//i, "").replace(/\/$/, ""))
    .refine((v) => v === "" || (v.length <= max && pattern.test(v)), message)
    .transform((v) => v || null);

/** Outros telefones: JSON [{ label, number }] vindo de um campo escondido. */
const otherPhones = z.preprocess(
  (v) => {
    if (typeof v !== "string" || !v) return [];
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  },
  z
    .array(
      z.object({
        label: z.string().trim().max(40, "Nome do telefone muito longo.").default(""),
        number: z
          .string()
          .transform(onlyDigits)
          .refine((d) => /^\d{10,13}$/.test(d), "Outro telefone inválido. Use DDD + número."),
      }),
    )
    .max(10, "No máximo 10 telefones extras."),
);

export const patientSchema = z
  .object({
    id: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.uuid().optional()),
    // Identificação
    fullName: text.pipe(z.string().min(3, "Informe o nome completo.").max(160, "Nome muito longo.")),
    nickname: optionalText(60),
    cpf: optionalCpf("CPF inválido."),
    rg: optionalText(20),
    birthDate: optionalDate("Data de nascimento inválida."),
    gender: optionalEnum(patientGenders),
    maritalStatus: optionalEnum(maritalStatuses),
    education: optionalEnum(educationLevels),
    recordNumber: optionalText(20),
    // Contato
    phoneCountry: text.transform(onlyDigits).refine((d) => d === "" || /^\d{1,3}$/.test(d), "Código do país inválido.").transform((d) => d || "55"),
    phone: optionalPhone,
    whatsappSameAsPhone: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
    whatsapp: optionalPhone,
    landline: text
      .transform(onlyDigits)
      .refine((d) => d === "" || /^[1-9]{2}\d{8}$/.test(d), "Telefone fixo inválido. Use DDD + 8 dígitos.")
      .transform((d) => d || null),
    otherPhones,
    email: text
      .refine((v) => v === "" || z.email().safeParse(v).success, "E-mail inválido.")
      .transform((v) => v.toLowerCase() || null),
    noEmail: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
    instagram: handle(30, /^[A-Za-z0-9._]+$/, "Instagram inválido: só o usuário, sem @."),
    facebook: handle(50, /^[A-Za-z0-9.]+$/, "Facebook inválido: só o usuário."),
    preferredContact: z.preprocess((v) => (v === "guardian" ? "guardian" : "patient"), z.enum(["patient", "guardian"])),
    // Endereço
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
    // Responsável e família
    guardianName: optionalText(160),
    guardianRelationship: optionalText(40),
    guardianCpf: optionalCpf("CPF do responsável inválido."),
    guardianRg: optionalText(20),
    guardianBirthDate: optionalDate("Data de nascimento do responsável inválida."),
    guardianPhone: optionalPhone,
    fatherName: optionalText(160),
    motherName: optionalText(160),
    // Trabalho
    occupation: optionalText(80),
    workplace: optionalText(120),
    // Como conheceu
    sourceId: optionalUuid,
    referral: text.refine((v) => v === "" || v === "none" || /^(patient|partner):[0-9a-f-]{36}$/i.test(v), "Indicação inválida."),
    // Observações e LGPD
    notes: optionalText(2000),
    consentLgpd: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
    /** A clínica exige e-mail (Configurações > Pacientes e captação); a action preenche. */
    requireEmail: z.preprocess((v) => v === true || v === "true", z.boolean()).default(false),
  })
  .superRefine((data, ctx) => {
    const minor = data.birthDate !== null && ageFromBirthDate(data.birthDate) < MINOR_AGE;
    if (minor) {
      // Menor de idade: responsável com nome, CPF e telefone.
      if (!data.guardianName) ctx.addIssue({ code: "custom", message: "Paciente menor de idade: informe o nome do responsável.", path: ["guardianName"] });
      if (!data.guardianCpf) ctx.addIssue({ code: "custom", message: "Informe o CPF do responsável.", path: ["guardianCpf"] });
      if (!data.guardianPhone) ctx.addIssue({ code: "custom", message: "Informe o telefone do responsável.", path: ["guardianPhone"] });
    }
    if (data.preferredContact === "guardian" && !data.guardianPhone) {
      ctx.addIssue({ code: "custom", message: "Para falar com o responsável, informe o telefone dele.", path: ["guardianPhone"] });
    }
    if (data.requireEmail && !data.noEmail && !data.email) {
      ctx.addIssue({ code: "custom", message: "Informe o e-mail ou marque \"não tem e-mail\".", path: ["email"] });
    }
  })
  .transform(({ whatsappSameAsPhone, ...data }) => {
    // requireEmail só serve à validação: não vai para o banco.
    const { requireEmail, ...rest } = data;
    void requireEmail;
    return { ...rest, email: rest.noEmail ? null : rest.email, whatsapp: whatsappSameAsPhone ? rest.phone : rest.whatsapp };
  });

export type PatientInput = z.output<typeof patientSchema>;

export const patientFiltersSchema = z.object({
  q: z.string().trim().max(100).catch(""),
  status: z.enum(["active", "archived"]).catch("active"),
  /** Origem (id da lista da clínica); valor antigo do link vira "todas". */
  sourceId: z.uuid().nullable().catch(null),
  /** Filtro rápido (em tratamento, orçamento em aberto...); nulo = todos. */
  segment: z.enum(["in_treatment", "open_quote", "return_overdue", "birthday"]).nullable().catch(null),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
