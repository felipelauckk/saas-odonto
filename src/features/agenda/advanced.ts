/** Regras puras da agenda avançada (séries, lista de espera, motivos). */

import { addMonths } from "@/lib/installments";
import { addDays } from "@/lib/timezone";

export type Repeat = "week" | "2weeks" | "month";

export const repeatLabels: Record<Repeat, string> = { week: "Toda semana", "2weeks": "A cada 2 semanas", month: "Todo mês" };

/** Datas da série a partir da primeira (inclusive). Mensal prende no fim do mês. */
export function seriesDates(first: string, repeat: Repeat, count: number): string[] {
  return Array.from({ length: count }, (_, i) =>
    repeat === "week" ? addDays(first, 7 * i) : repeat === "2weeks" ? addDays(first, 14 * i) : addMonths(first, i),
  );
}

export type Period = "any" | "morning" | "afternoon" | "evening";
export const periodLabels: Record<Period, string> = { any: "Qualquer horário", morning: "Manhã", afternoon: "Tarde", evening: "Noite" };

export function periodOf(startMin: number): Exclude<Period, "any"> {
  return startMin < 12 * 60 ? "morning" : startMin < 18 * 60 ? "afternoon" : "evening";
}

/** Quem da lista de espera cabe num horário que vagou. */
export function fitsWaitlist(
  entry: { professionalId: string | null; unitId: string; period: Period },
  slot: { professionalId: string; unitId: string; startMin: number },
): boolean {
  return (
    entry.unitId === slot.unitId &&
    (entry.professionalId === null || entry.professionalId === slot.professionalId) &&
    (entry.period === "any" || entry.period === periodOf(slot.startMin))
  );
}

export type CancelReason = "patient_canceled" | "clinic_canceled" | "rescheduled";
export const cancelReasonLabels: Record<CancelReason, string> = {
  patient_canceled: "Paciente desmarcou",
  clinic_canceled: "Clínica desmarcou",
  rescheduled: "Remarcada",
};

/** "Atrasado": agendada ou confirmada, começou há mais de 10 min e o paciente não chegou. Não é status salvo. */
export function isLate(a: { status: string; startsAt: string; arrivedAt: string | null }, now: number): boolean {
  return (a.status === "scheduled" || a.status === "confirmed") && !a.arrivedAt && now - Date.parse(a.startsAt) > 10 * 60_000;
}
