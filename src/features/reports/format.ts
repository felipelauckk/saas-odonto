import { formatCurrency } from "@/lib/format";
import { formatPhone } from "@/lib/documents";
import type { Cell, Sheet } from "@/lib/spreadsheet";

import type { Column, ReportResult } from "./types";

const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat("pt-BR");

/** Valor de uma célula como texto para a tela. */
export function formatCell(col: Column, value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  switch (col.type) {
    case "money":
      return formatCurrency(Math.round(Number(value)));
    case "percent":
      return percent.format(Number(value));
    case "decimal":
      return decimal.format(Number(value));
    case "int":
      return integer.format(Number(value));
    case "date":
      return String(value).split("-").reverse().join("/");
    default:
      return col.key === "phone" ? formatPhone(String(value)) : String(value);
  }
}

/** Resultado → planilha (dinheiro em reais, percentual em %, datas dd/mm/aaaa). */
export function toSheet(title: string, result: ReportResult): Sheet {
  const header = result.columns.map((c) => (c.type === "percent" ? `${c.label} (%)` : c.label));
  const cell = (col: Column, v: string | number | null | undefined): Cell => {
    if (v === null || v === undefined || v === "") return null;
    if (col.type === "money") return Math.round(Number(v)) / 100;
    if (col.type === "percent") return Math.round(Number(v) * 1000) / 10;
    if (col.type === "decimal") return Math.round(Number(v) * 10) / 10;
    if (col.type === "int") return Number(v);
    if (col.type === "date") return String(v).split("-").reverse().join("/");
    return col.key === "phone" ? formatPhone(String(v)) : String(v);
  };
  const rows = [...result.rows, ...(result.total ? [result.total] : [])].map((r) => result.columns.map((c) => cell(c, r[c.key])));
  return { name: title, header, rows, moneyColumns: result.columns.flatMap((c, i) => (c.type === "money" ? [i] : [])) };
}
