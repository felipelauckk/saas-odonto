import { addDays } from "@/lib/timezone";

export type MonthFlow = { month: string; inCents: number; outCents: number; resultCents: number; partial: boolean };

/** Primeiro dia (AAAA-MM-01) de `count` meses terminando no mês de `today`. */
export function lastMonths(today: string, count: number): string[] {
  const [y, m] = today.split("-").map(Number) as [number, number];
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (count - 1 - i), 1));
    return d.toISOString().slice(0, 10);
  });
}

/**
 * Entradas e saídas realizadas (caixa) de cada mês, com o resultado. Mês sem
 * movimento aparece zerado; o mês corrente vem marcado como parcial.
 */
export function monthlyFlow(rows: { bucket: string; realizedIn: number; realizedOut: number }[], today: string, count = 6): MonthFlow[] {
  const byMonth = new Map(rows.map((r) => [r.bucket, r]));
  const current = `${today.slice(0, 7)}-01`;
  return lastMonths(today, count).map((month) => {
    const r = byMonth.get(month);
    const inCents = r?.realizedIn ?? 0;
    const outCents = r?.realizedOut ?? 0;
    return { month, inCents, outCents, resultCents: inCents - outCents, partial: month === current };
  });
}

/** Margem do mês (resultado ÷ entradas), nula sem entradas. */
export function margin(inCents: number, outCents: number): number | null {
  return inCents > 0 ? (inCents - outCents) / inCents : null;
}

export type DueUrgency = "late" | "soon" | "ok";

/** Vencido, vence em até 2 dias ou com folga. */
export function dueUrgency(dueDate: string, today: string): DueUrgency {
  if (dueDate < today) return "late";
  if (dueDate <= addDays(today, 2)) return "soon";
  return "ok";
}

/** "R$ 17 mil", "R$ 1,2 mil", "R$ 850": rótulo curto acima das barras. */
export function shortMoney(cents: number): string {
  const reais = Math.abs(cents) / 100;
  const sign = cents < 0 ? "−" : "+";
  if (reais >= 1000) {
    const mil = reais / 1000;
    return `${sign}R$ ${mil.toLocaleString("pt-BR", { maximumFractionDigits: mil >= 10 ? 0 : 1 })} mil`;
  }
  return `${sign}R$ ${Math.round(reais).toLocaleString("pt-BR")}`;
}
