/**
 * Horários livres num dia, em minutos desde a meia-noite (fuso de São Paulo).
 * Usado pela grade da "Nova consulta" e pelo agendamento online.
 */

import { minutesToTime } from "@/lib/timezone";

import { periodOf } from "./advanced";

export type Range = { startMin: number; endMin: number };

/** Faixa liberada por "Mostrar fora do expediente". */
export const OUTSIDE_HOURS: Range = { startMin: 6 * 60, endMin: 22 * 60 };

/**
 * Inícios possíveis dentro das janelas (expediente), a cada `stepMin`, em que
 * a consulta inteira (`durationMin`) cabe sem encostar em nada ocupado.
 * `earliestMin` corta o que já passou (hoje) ou a antecedência mínima.
 */
export function slotStarts(input: { windows: Range[]; busy: Range[]; durationMin: number; stepMin: number; earliestMin?: number }): number[] {
  const out = new Set<number>();
  const { busy, durationMin, stepMin } = input;
  const earliest = input.earliestMin ?? -Infinity;
  for (const w of input.windows) {
    for (let t = w.startMin; t + durationMin <= w.endMin; t += stepMin) {
      if (t < earliest) continue;
      if (busy.some((b) => b.startMin < t + durationMin && b.endMin > t)) continue;
      out.add(t);
    }
  }
  return [...out].sort((a, b) => a - b);
}

export type SlotGroup = { period: "morning" | "afternoon" | "evening"; label: string; times: string[] };

const GROUP_LABELS = { morning: "Manhã", afternoon: "Tarde", evening: "Noite" } as const;

/** Manhã (até 12h), Tarde (até 18h) e Noite, como na lista de espera. Períodos vazios saem. */
export function groupByPeriod(starts: number[]): SlotGroup[] {
  const groups: SlotGroup[] = (["morning", "afternoon", "evening"] as const).map((period) => ({ period, label: GROUP_LABELS[period], times: [] }));
  for (const m of starts) groups.find((g) => g.period === periodOf(m))!.times.push(minutesToTime(m));
  return groups.filter((g) => g.times.length);
}

/** Intervalo UTC recortado ao dia (minutos desde a meia-noite local), ou null se não toca o dia. */
export function clipToDay(start: number, end: number, dayStartMs: number): Range | null {
  const startMin = Math.max(0, Math.floor((start - dayStartMs) / 60_000));
  const endMin = Math.min(24 * 60, Math.ceil((end - dayStartMs) / 60_000));
  return endMin > startMin ? { startMin, endMin } : null;
}
