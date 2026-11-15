export type GoalMetric = "revenue" | "production" | "approved_quotes" | "new_patients" | "conversion";

export type MonthStats = {
  month: string; // AAAA-MM
  revenue: number;
  production: number;
  approvedQuotes: number;
  approvedValue: number;
  issued: number;
  /** Dos orçamentos emitidos no mês, quantos já foram aprovados. */
  issuedApproved: number;
  newPatients: number;
};

export const goalMetrics: readonly GoalMetric[] = ["revenue", "production", "approved_quotes", "new_patients", "conversion"];

export const metricLabels: Record<GoalMetric, string> = {
  revenue: "Faturamento (recebido)",
  production: "Produção",
  approved_quotes: "Orçamentos aprovados",
  new_patients: "Novos pacientes",
  conversion: "Taxa de conversão",
};

/** Como o valor da meta é digitado/mostrado. */
export const metricKind: Record<GoalMetric, "money" | "count" | "percent"> = {
  revenue: "money",
  production: "money",
  approved_quotes: "count",
  new_patients: "count",
  conversion: "percent",
};

export function emptyMonth(month: string): MonthStats {
  return { month, revenue: 0, production: 0, approvedQuotes: 0, approvedValue: 0, issued: 0, issuedApproved: 0, newPatients: 0 };
}

export function conversion(s: MonthStats): number | null {
  return s.issued ? s.issuedApproved / s.issued : null;
}

/** Valor realizado de um indicador (novos pacientes só existe no total da clínica). */
export function actualOf(s: MonthStats, metric: GoalMetric): number | null {
  switch (metric) {
    case "revenue":
      return s.revenue;
    case "production":
      return s.production;
    case "approved_quotes":
      return s.approvedQuotes;
    case "new_patients":
      return s.newPatients;
    case "conversion":
      return conversion(s);
  }
}

/** Progresso da meta (0–1+), ou nulo sem meta. */
export function progress(actual: number | null, target: number | undefined): number | null {
  if (target === undefined || target <= 0 || actual === null) return null;
  return actual / target;
}

export function nextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

export function prevMonth(month: string): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** Os N meses terminando em `month` (do mais antigo ao mais recente). */
export function monthsBack(month: string, n: number): string[] {
  const out = [month];
  while (out.length < n) out.unshift(prevMonth(out[0]!));
  return out;
}

const monthNames = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export function shortMonth(month: string): string {
  const [y, m] = month.split("-");
  return `${monthNames[Number(m) - 1]}/${y!.slice(2)}`;
}
