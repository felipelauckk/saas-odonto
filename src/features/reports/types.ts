export type ColumnType = "text" | "int" | "money" | "percent" | "date" | "decimal";
export type Column = { key: string; label: string; type: ColumnType };
export type Row = Record<string, string | number | null>;
export type ReportResult = {
  columns: Column[];
  rows: Row[];
  /** Indicadores em destaque acima da tabela. */
  summary?: { label: string; value: number; type: ColumnType }[];
  /** Linha de total (mesmas chaves das colunas). */
  total?: Row;
  note?: string;
};

export type ReportFilters = {
  from: string;
  to: string;
  unitId: string | null;
  professionalId: string | null;
  months: number;
  groupBy: string;
};
