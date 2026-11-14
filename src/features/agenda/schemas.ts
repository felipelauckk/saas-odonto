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

export const appointmentSchema = z.object({
  id: z.uuid().optional(),
  patientId: z.uuid({ message: "Escolha o paciente." }),
  professionalId: z.uuid({ message: "Escolha o profissional." }),
  chairId: nullableId,
  procedureId: nullableId,
  date: isoDate,
  time,
  durationMin: z.coerce.number().int().min(5, "Duração mínima de 5 minutos.").max(720, "Duração máxima de 12 horas."),
  type: optionalText(120),
  notes: optionalText(2000),
});

export const moveAppointmentSchema = z.object({
  id: z.uuid(),
  date: isoDate,
  time,
  professionalId: z.uuid().optional(),
  /** undefined = não muda; null = sem cadeira. */
  chairId: z.uuid().nullable().optional(),
});

export const statusSchema = z.object({
  id: z.uuid(),
  status: z.enum(appointmentStatuses),
});

export const blockSchema = z
  .object({
    professionalId: nullableId,
    date: isoDate,
    allDay: z.boolean(),
    startTime: time,
    endTime: time,
    reason: optionalText(200),
  })
  .refine((b) => b.allDay || b.endTime > b.startTime, {
    message: "O fim precisa ser depois do início.",
    path: ["endTime"],
  });

export const agendaParamsSchema = z.object({
  data: isoDate.optional().catch(undefined),
  visao: z.enum(["dia", "semana"]).catch("dia"),
  por: z.enum(["profissional", "cadeira"]).catch("profissional"),
  id: z.uuid().optional().catch(undefined),
});

export type AppointmentInput = z.input<typeof appointmentSchema>;
export type BlockInput = z.input<typeof blockSchema>;
