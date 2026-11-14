/** Soma meses a uma data AAAA-MM-DD, prendendo no último dia do mês (31/01 + 1 mês = 28/02). */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

export type Installment = { number: number; amountCents: number; dueDate: string };

/**
 * Divide um valor em parcelas mensais. Os centavos que sobram vão para a
 * primeira parcela — a mesma regra da função approve_treatment_plan no banco.
 */
export function splitInstallments(totalCents: number, count: number, firstDueDate: string): Installment[] {
  if (totalCents <= 0 || count < 1) return [];
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    amountCents: base + (i === 0 ? remainder : 0),
    dueDate: addMonths(firstDueDate, i),
  }));
}
