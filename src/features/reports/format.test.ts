import { describe, expect, it } from "vitest";

import { reportBySlug } from "./catalog";
import { parseReportFilters } from "./filters";
import { formatCell, toSheet } from "./format";

describe("relatórios: formato e filtros", () => {
  it("formata dinheiro, percentual e data", () => {
    expect(formatCell({ key: "v", label: "", type: "money" }, 123456)).toMatch(/R\$\s?1\.234,56/);
    expect(formatCell({ key: "v", label: "", type: "percent" }, 0.255)).toBe("25,5%");
    expect(formatCell({ key: "v", label: "", type: "date" }, "2026-11-15")).toBe("15/11/2026");
    expect(formatCell({ key: "v", label: "", type: "int" }, null)).toBe("—");
  });

  it("planilha leva dinheiro em reais e o total no fim", () => {
    const sheet = toSheet("Teste", {
      columns: [{ key: "group", label: "Grupo", type: "text" }, { key: "v", label: "Valor", type: "money" }, { key: "p", label: "Taxa", type: "percent" }],
      rows: [{ group: "A", v: 1050, p: 0.5 }],
      total: { group: "Total", v: 1050, p: 0.5 },
    });
    expect(sheet.header).toEqual(["Grupo", "Valor", "Taxa (%)"]);
    expect(sheet.rows).toEqual([["A", 10.5, 50], ["Total", 10.5, 50]]);
    expect(sheet.moneyColumns).toEqual([1]);
  });

  it("filtros: padrão do mês, agrupamento válido e período limitado", () => {
    const def = reportBySlug.get("faturamento")!;
    const f = parseReportFilters(def, { agrupar: "xyz", unidade: "nao-e-uuid" }, "2026-11-15");
    expect(f).toMatchObject({ from: "2026-11-01", to: "2026-11-15", groupBy: "mes", unitId: null });
    expect(parseReportFilters(def, { de: "2020-01-01", ate: "2026-11-15" }, "2026-11-15").from).toBe("2024-11-14");
    expect(parseReportFilters(def, { de: "2026-12-01", ate: "2026-11-15" }, "2026-11-15").from).toBe("2026-11-15");
  });
});
