/** Regras puras dos compromissos da agenda (P2): repetição, faixa de horário e sugestões. */

import { addMonths } from "@/lib/installments";
import { addDays, weekdayOf } from "@/lib/timezone";

export type CommitmentRepeat = "none" | "weekdays" | "week" | "2weeks" | "month";

export const commitmentRepeatLabels: Record<CommitmentRepeat, string> = {
  none: "Não se repete",
  weekdays: "Todo dia útil (seg–sex)",
  week: "Toda semana",
  "2weeks": "A cada 2 semanas",
  month: "Todo mês",
};

export const COMMITMENT_SUGGESTIONS = ["Almoço", "Reunião", "Curso", "Feriado", "Manutenção"] as const;

/** Máximo de ocorrências numa série (igual às consultas em série). */
export const MAX_OCCURRENCES = 52;

const isWeekday = (date: string) => {
  const w = weekdayOf(date);
  return w >= 1 && w <= 5;
};

/**
 * Datas da série a partir da primeira, até `until` (inclusive) ou `count`
 * ocorrências; nunca mais que 52. Dia útil pula sábado e domingo (se a primeira
 * cair no fim de semana, começa na segunda). Mensal prende no fim do mês.
 */
export function commitmentDates(first: string, repeat: CommitmentRepeat, end: { until?: string | null; count?: number | null }): string[] {
  if (repeat === "none") return [first];
  const limit = Math.min(end.count ?? MAX_OCCURRENCES, MAX_OCCURRENCES);
  const until = end.until ?? null;
  const out: string[] = [];
  if (repeat === "weekdays") {
    // Uma volta grande o bastante para 52 dias úteis.
    for (let d = first, guard = 0; out.length < limit && guard < 400; d = addDays(d, 1), guard++) {
      if (until && d > until) break;
      if (isWeekday(d)) out.push(d);
    }
    return out;
  }
  for (let i = 0; out.length < limit; i++) {
    const d = repeat === "week" ? addDays(first, 7 * i) : repeat === "2weeks" ? addDays(first, 14 * i) : addMonths(first, i);
    if (until && d > until) break;
    out.push(d);
  }
  return out;
}

/**
 * Escolha de faixa em botões de 15 min: o primeiro clique marca o início, o
 * segundo o fim (o fim inclui o botão clicado). Clicar antes do início, ou
 * depois de a faixa estar completa, recomeça.
 */
export function pickRange(current: { startMin: number | null; endMin: number | null }, clicked: number, stepMin = 15): { startMin: number; endMin: number | null } {
  if (current.startMin === null || current.endMin !== null || clicked < current.startMin) return { startMin: clicked, endMin: null };
  return { startMin: current.startMin, endMin: clicked + stepMin };
}
