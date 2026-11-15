/** Faixa etária em anos completos na data de referência. */
export function ageBand(birthDate: string | null, today: string): string {
  if (!birthDate) return "Sem data de nascimento";
  const [by, bm, bd] = birthDate.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = today.split("-").map(Number) as [number, number, number];
  const age = ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
  if (age < 13) return "0 a 12";
  if (age < 18) return "13 a 17";
  if (age < 30) return "18 a 29";
  if (age < 45) return "30 a 44";
  if (age < 60) return "45 a 59";
  return "60 ou mais";
}
export const AGE_BANDS = ["0 a 12", "13 a 17", "18 a 29", "30 a 44", "45 a 59", "60 ou mais", "Sem data de nascimento"];

/** Idade da dívida em dias → faixa. */
export function debtBucket(days: number): "d30" | "d60" | "d90" | "d90plus" {
  if (days <= 30) return "d30";
  if (days <= 60) return "d60";
  if (days <= 90) return "d90";
  return "d90plus";
}

/** O aniversário (mês-dia) cai entre duas datas (inclusive), mesmo virando o ano? */
export function birthdayInRange(birthDate: string, from: string, to: string): string | null {
  const md = birthDate.slice(5);
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) {
    // 29/02 em ano não bissexto conta em 28/02.
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    const date = `${y}-${md === "02-29" && !leap ? "02-28" : md}`;
    if (date >= from && date <= to) return date;
  }
  return null;
}

export type Interval = { start: number; end: number };

/** Soma de intervalos sem contar sobreposição duas vezes (minutos). */
export function unionMinutes(intervals: Interval[]): number {
  const sorted = [...intervals].filter((i) => i.end > i.start).sort((a, b) => a.start - b.start);
  let total = 0;
  let curStart = -Infinity;
  let curEnd = -Infinity;
  for (const i of sorted) {
    if (i.start > curEnd) {
      if (curEnd > curStart) total += curEnd - curStart;
      curStart = i.start;
      curEnd = i.end;
    } else {
      curEnd = Math.max(curEnd, i.end);
    }
  }
  if (curEnd > curStart) total += curEnd - curStart;
  return total;
}

/** Parte de "a" que fica dentro de "b" (minutos). */
export function overlapMinutes(a: Interval, b: Interval): number {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
}

/**
 * Rateia um valor pago entre itens pelo valor de cada um (o resto de centavos
 * vai para o último), para faturamento por procedimento e categoria.
 */
export function allocate(amountCents: number, weights: { key: string; weight: number }[]): Map<string, number> {
  const result = new Map<string, number>();
  const total = weights.reduce((s, w) => s + w.weight, 0);
  if (!total) return result;
  let used = 0;
  weights.forEach((w, i) => {
    const share = i === weights.length - 1 ? amountCents - used : Math.round((amountCents * w.weight) / total);
    used += share;
    result.set(w.key, (result.get(w.key) ?? 0) + share);
  });
  return result;
}
