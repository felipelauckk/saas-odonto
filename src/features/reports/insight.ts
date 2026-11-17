import type { Column, ReportResult } from "./types";

export type Bar = { label: string; value: number; share: number };
export type Insight = { valueColumn: Column; labelColumn: Column; bars: Bar[]; others: number; text: string };

const pct = (v: number) => `${Math.round(v * 100)}%`;

/**
 * Barras e conclusão escrita, por regras (sem IA): vale para relatórios
 * agrupados por um texto (profissional, procedimento, forma de pagamento...)
 * com uma coluna de dinheiro (ou, sem ela, de quantidade). Nulo quando não se
 * aplica: menos de dois grupos ou nada somado.
 */
export function reportInsight(result: Pick<ReportResult, "columns" | "rows">, maxBars = 8): Insight | null {
  const labelColumn = result.columns.find((c) => c.type === "text");
  const valueColumn = result.columns.find((c) => c.type === "money") ?? result.columns.find((c) => c.type === "int");
  if (!labelColumn || !valueColumn) return null;
  const items = result.rows
    .map((r) => ({ label: String(r[labelColumn.key] ?? "").trim(), value: Number(r[valueColumn.key] ?? 0) }))
    .filter((i) => i.label && Number.isFinite(i.value) && i.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = items.reduce((s, i) => s + i.value, 0);
  if (items.length < 2 || total <= 0) return null;

  const bars = items.slice(0, maxBars).map((i) => ({ ...i, share: i.value / total }));
  const others = items.slice(maxBars).reduce((s, i) => s + i.value, 0);
  const [first, second] = bars as [Bar, Bar];
  const last = items.at(-1)!;
  const what = valueColumn.label.toLowerCase();

  const sentences = [`${first.label} responde por ${pct(first.share)} do ${what}.`];
  if (items.length === 2) {
    sentences.push(`${second.label} fica com os outros ${pct(second.share)}.`);
  } else {
    const top3 = bars.slice(0, 3).reduce((s, b) => s + b.share, 0);
    if (items.length > 3) sentences.push(`Os três primeiros somam ${pct(top3)} de ${items.length}.`);
    sentences.push(`${last.label} tem a menor fatia (${pct(last.value / total)}).`);
  }
  return { valueColumn, labelColumn, bars, others, text: sentences.join(" ") };
}
