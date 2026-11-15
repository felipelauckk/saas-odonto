import { z } from "zod";

import { isValidCnpj, isValidCpf, onlyDigits } from "@/lib/documents";
import { parseBRLToCents, parseDecimal } from "@/lib/money";

// Campos de formulário chegam como texto (ou ausentes). ---------------------------

const text = z.preprocess((v) => (typeof v === "string" ? v : ""), z.string().trim());

/** Texto opcional: vazio vira null. */
const optionalText = (max: number, message = "Texto muito longo.") =>
  text.pipe(z.string().max(max, message)).transform((v) => v || null);

const requiredText = (message: string, max = 120) =>
  text.pipe(z.string().min(1, message).max(max, "Texto muito longo."));

/** Switch/checkbox: "on" quando marcado, ausente quando não. */
export const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

const optionalId = z.preprocess((v) => (v === "" || v == null ? undefined : v), z.uuid().optional());

const optionalPhone = text
  .transform(onlyDigits)
  .refine((d) => d === "" || /^[1-9]{2}9?\d{8}$/.test(d), "Telefone inválido. Use DDD + número.")
  .transform((d) => d || null);

const optionalEmail = text
  .refine((v) => v === "" || z.email().safeParse(v).success, "E-mail inválido.")
  .transform((v) => v.toLowerCase() || null);

const integer = (min: number, max: number, message: string) =>
  text.pipe(z.string().regex(/^\d+$/, message)).transform(Number).pipe(z.number().int().min(min, message).max(max, message));

// Clínica ---------------------------------------------------------------------------

export const clinicSchema = z.object({
  name: requiredText("Informe o nome da clínica."),
  legalName: optionalText(200),
  document: text
    .transform(onlyDigits)
    .refine(
      (d) => d === "" || (d.length === 11 && isValidCpf(d)) || (d.length === 14 && isValidCnpj(d)),
      "CPF ou CNPJ inválido.",
    )
    .transform((d) => d || null),
  phone: optionalPhone,
  email: optionalEmail,
});

// Unidades --------------------------------------------------------------------------

export const unitSchema = z.object({
  id: optionalId,
  name: requiredText("Informe o nome da unidade."),
  phone: optionalPhone,
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
  active: checkbox,
});

// Cadeiras --------------------------------------------------------------------------

export const chairSchema = z.object({
  id: optionalId,
  unitId: z.uuid({ message: "Escolha a unidade." }),
  name: requiredText("Informe o nome da cadeira.", 60),
  active: checkbox,
});

// Profissionais -----------------------------------------------------------------------

export const professionalSchema = z.object({
  id: optionalId,
  name: requiredText("Informe o nome do profissional."),
  cro: optionalText(30),
  specialty: optionalText(80),
  color: text.pipe(z.string().regex(/^#[0-9a-fA-F]{6}$/, "Escolha uma cor.")),
  memberId: z.preprocess((v) => (v === "" || v === "none" || v == null ? null : v), z.uuid().nullable()),
  active: checkbox,
});

// Procedimentos -----------------------------------------------------------------------

export const procedureSchema = z.object({
  id: optionalId,
  name: requiredText("Informe o nome do procedimento.", 160),
  code: optionalText(30),
  category: optionalText(60),
  price: text.transform((v, ctx) => {
    const cents = parseBRLToCents(v === "" ? "0" : v);
    if (cents === null) {
      ctx.addIssue({ code: "custom", message: "Valor inválido. Ex.: 150,00" });
      return z.NEVER;
    }
    return cents;
  }),
  durationMin: integer(5, 600, "Duração entre 5 e 600 minutos."),
  returnMonths: text
    .refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 60), "Entre 1 e 60 meses.")
    .transform((v) => (v === "" ? null : Number(v))),
  appliesToTooth: checkbox,
  active: checkbox,
});

// Formas de pagamento -----------------------------------------------------------------

export const paymentMethodSchema = z.object({
  id: optionalId,
  name: requiredText("Informe o nome.", 60),
  feePercent: text.transform((v, ctx) => {
    const value = parseDecimal(v === "" ? "0" : v);
    if (value === null || value > 100) {
      ctx.addIssue({ code: "custom", message: "Taxa entre 0 e 100%." });
      return z.NEVER;
    }
    return value;
  }),
  daysToReceive: integer(0, 365, "Prazo entre 0 e 365 dias."),
  active: checkbox,
});

// Horários ---------------------------------------------------------------------------

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido.");

export const scheduleEntrySchema = z
  .object({
    unitId: z.uuid(),
    weekday: z.number().int().min(0).max(6),
    start: time,
    end: time,
  })
  .refine((e) => e.end > e.start, { message: "O fim precisa ser depois do início.", path: ["end"] });

export const scheduleSchema = z
  .object({
    professionalId: z.uuid(),
    entries: z.array(scheduleEntrySchema).max(42),
  })
  .superRefine(({ entries }, ctx) => {
    for (let day = 0; day <= 6; day++) {
      const sorted = entries.filter((e) => e.weekday === day).sort((a, b) => a.start.localeCompare(b.start));
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i]!.start < sorted[i - 1]!.end) {
          ctx.addIssue({ code: "custom", message: "Há períodos que se sobrepõem no mesmo dia.", path: ["entries"] });
          return;
        }
      }
    }
  });

export type ScheduleEntry = z.infer<typeof scheduleEntrySchema>;

// Unidades permitidas por membro ---------------------------------------------------------

export const memberUnitsSchema = z.object({
  memberId: z.uuid(),
  unitIds: z.array(z.uuid()),
});
