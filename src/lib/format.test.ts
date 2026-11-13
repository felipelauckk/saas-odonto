import { describe, expect, it } from "vitest";

import { formatCurrency, formatDate, formatDateTime } from "./format";

// Intl usa espaço não separável (U+00A0) entre "R$" e o número.
const normalize = (s: string) => s.replace(/ /g, " ");

describe("formatCurrency", () => {
  it("converte centavos em reais", () => {
    expect(normalize(formatCurrency(123456))).toBe("R$ 1.234,56");
  });

  it("formata zero e valores pequenos", () => {
    expect(normalize(formatCurrency(0))).toBe("R$ 0,00");
    expect(normalize(formatCurrency(5))).toBe("R$ 0,05");
  });

  it("formata valores negativos", () => {
    expect(normalize(formatCurrency(-1050))).toBe("-R$ 10,50");
  });

  it("rejeita valores que não são centavos inteiros", () => {
    expect(() => formatCurrency(10.5)).toThrow(TypeError);
  });
});

describe("formatDate", () => {
  it("usa o fuso de São Paulo, não UTC", () => {
    // 02:00 UTC do dia 14 = 23:00 do dia 13 em São Paulo (UTC-3).
    expect(formatDate("2026-11-14T02:00:00Z")).toBe("13/11/2026");
  });

  it("aceita objetos Date", () => {
    expect(formatDate(new Date("2026-01-05T12:00:00Z"))).toBe("05/01/2026");
  });

  it("rejeita datas inválidas", () => {
    expect(() => formatDate("não é data")).toThrow(RangeError);
  });
});

describe("formatDateTime", () => {
  it("mostra a hora local de São Paulo", () => {
    expect(formatDateTime("2026-11-13T17:30:00Z")).toBe("13/11/2026, 14:30");
  });
});
