import { z } from "zod";

import { appointmentStatuses } from "./labels";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido.");
const nullableId = z.preprocess((v) => (v === "" || v === "none" || v === undefined ? null : v), z.uuid().nullable());
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "Texto muito longo.")
    .optional()
    .transform((v) => v || null);

export const confirmationModes = ["auto", "none", "now"] as const;
export const reminderModes = ["auto", "none"] as const;
export type ConfirmationMode = (typeof confirmationModes)[number];
export type ReminderMode = (typeof reminderModes)[number];

const tooth = z
  .number()
  .int()
  .refine((t) => (Math.floor(t / 10) >= 1 && Math.floor(t / 10) <= 4 && t % 10 >= 1 && t % 10 <= 8) || (Math.floor(t / 10) >= 5 && Math.floor(t / 10) <= 8 && t % 10 >= 1 && t % 10 <= 5), "Dente inválido.");

export const appointmentProcedureSchema = z
  .object({
    /** null = item do plano escrito à mão (sem procedimento cadastrado). */
    procedureId: z.uuid().nullable(),
    /** Nome do item do plano; vazio quando vem do catálogo. */
    description: z
      .string()
      .trim()
      .max(200)
      .nullish()
      .transform((v) => v || null),
    treatmentItemId: z.uuid().nullable().default(null),
    tooth: tooth.nullable().default(null),
    faces: z.array(z.enum(["M", "D", "O", "V", "L"])).max(5).nullable().default(null),
  })
  .refine((p) => p.procedureId !== null || p.description !== null, { message: "Procedimento sem nome." });

export const appointmentSchema = z.object({
  id: z.uuid().optional(),
  patientId: z.uuid({ message: "Escolha o paciente." }),
  professionalId: z.uuid({ message: "Escolha o profissional." }),
  chairId: nullableId,
  procedures: z.array(appointmentProcedureSchema).max(20, "No máximo 20 procedimentos por consulta.").default([]),
  date: isoDate,
  time,
  durationMin: z.coerce.number().int().min(5, "Duração mínima de 5 minutos.").max(720, "Duração máxima de 12 horas."),
  type: optionalText(120),
  notes: optionalText(2000),
  tagIds: z.array(z.uuid()).max(10).optional(),
  repeat: z.enum(["week", "2weeks", "month"]).nullable().optional(),
  repeatCount: z.number().int().min(2).max(52).optional(),
  confirmationMode: z.enum(confirmationModes).default("auto"),
  reminderMode: z.enum(reminderModes).default("auto"),
});

export const moveAppointmentSchema = z.object({
  id: z.uuid(),
  date: isoDate,
  time,
  professionalId: z.uuid().optional(),
  /** undefined = não muda; null = sem cadeira. */
  chairId: z.uuid().nullable().optional(),
});

export const statusSchema = z
  .object({
    id: z.uuid(),
    status: z.enum(appointmentStatuses),
    cancelReason: z.enum(["patient_canceled", "clinic_canceled", "rescheduled"]).optional(),
    cancelNote: z.string().trim().max(300).optional(),
  })
  .refine((s) => s.status !== "canceled" || s.cancelReason, { message: "Informe o motivo da desmarcação." });

export const commitmentScopes = ["one", "following", "all"] as const;
export type CommitmentScope = (typeof commitmentScopes)[number];

/** Compromisso (bloqueio ou evento). Editar numa série aplica ao escopo escolhido. */
export const commitmentSchema = z
  .object({
    id: z.uuid().optional(),
    scope: z.enum(commitmentScopes).default("one"),
    title: z.string().trim().min(1, "Dê um nome ao compromisso.").max(120, "Nome muito longo."),
    notes: optionalText(1000),
    /** null = clínica toda (na unidade selecionada). */
    professionalId: nullableId,
    kind: z.enum(["block", "event"]),
    date: isoDate,
    allDay: z.boolean(),
    startTime: time,
    endTime: z.string().regex(/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/, "Horário inválido."),
    repeat: z.enum(["none", "weekdays", "week", "2weeks", "month"]).default("none"),
    until: isoDate.nullish(),
    count: z.number().int().min(2).max(52).nullish(),
  })
  .refine((b) => b.allDay || b.endTime > b.startTime, { message: "O fim precisa ser depois do início.", path: ["endTime"] })
  .refine((b) => b.repeat === "none" || b.id || b.until || b.count, { message: "Diga até quando ou quantas vezes repete.", path: ["until"] })
  .refine((b) => !b.until || b.until >= b.date, { message: "O fim da repetição precisa ser depois da primeira data.", path: ["until"] });

export const agendaParamsSchema = z.object({
  data: isoDate.optional().catch(undefined),
  visao: z.enum(["dia", "semana"]).catch("dia"),
  por: z.enum(["profissional", "cadeira"]).catch("profissional"),
  id: z.uuid().optional().catch(undefined),
  paciente: z.uuid().optional().catch(undefined),
});

export type AppointmentInput = z.input<typeof appointmentSchema>;
export type CommitmentInput = z.input<typeof commitmentSchema>;

export const slotsQuerySchema = z.object({
  professionalId: z.uuid(),
  date: isoDate,
  durationMin: z.number().int().min(5).max(720),
  /** Consulta sendo editada: o horário dela não conta como ocupado. */
  excludeId: z.uuid().nullable().default(null),
  outsideHours: z.boolean().default(false),
});

export type AppointmentProcedureInput = z.input<typeof appointmentProcedureSchema>;
