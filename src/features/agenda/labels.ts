import type { Database } from "@/lib/supabase/database.types";

export type AppointmentStatus = Database["public"]["Enums"]["appointment_status"];

export const appointmentStatuses = [
  "scheduled",
  "confirmed",
  "arrived",
  "in_progress",
  "done",
  "no_show",
  "canceled",
] as const satisfies readonly AppointmentStatus[];

export const statusLabels: Record<AppointmentStatus, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  arrived: "Na espera",
  in_progress: "Em atendimento",
  done: "Atendido",
  no_show: "Faltou",
  canceled: "Desmarcado",
};

/** Status que liberam o horário (não contam como conflito). */
export const FREEING_STATUSES: readonly AppointmentStatus[] = ["no_show", "canceled"];

export const DURATION_OPTIONS = [15, 20, 30, 40, 45, 60, 90, 120, 180] as const;

/** Grade: altura de 1 hora em px (15 min = 30px, com folga para o horário escrito; 30 min passa do mínimo de toque de 44px). */
export const HOUR_HEIGHT = 120;
/** Arrastar e clicar encaixam de 15 em 15 minutos. */
export const SNAP_MINUTES = 15;
