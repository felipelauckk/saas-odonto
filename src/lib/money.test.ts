import { describe, expect, it } from "vitest";

import { centsToInput, parseBRLToCents, parseDecimal } from "./money";

describe("parseBRLToCents", () => {
  it.each([
    ["1.234,56", 123456],
    ["1234,56", 123456],
    ["1234.56", 123456],
    ["R$ 1.234,56", 123456],
    ["150", 15000],
    ["150,5", 15050],
    ["0,99", 99],
    ["1.000", 100000],
    ["0", 0],
  ])("%s → %i centavos", (input, cents) => {
    expect(parseBRLToCents(input)).toBe(cents);
  });

  it.each(["", "abc", "-10", "1,234", "12,345", "1.23.4"])("rejeita %j", (input) => {
    expect(parseBRLToCents(input)).toBeNull();
  });
});

describe("centsToInput", () => {
  it("formata para o campo", () => {
    expect(centsToInput(123456)).toBe("1.234,56");
    expect(centsToInput(0)).toBe("0,00");
  });

  it("ida e volta mantém o valor", () => {
    for (const cents of [0, 1, 99, 15000, 123456, 9999999]) {
      expect(parseBRLToCents(centsToInput(cents))).toBe(cents);
    }
  });
});

describe("parseDecimal", () => {
  it("aceita vírgula ou ponto", () => {
    expect(parseDecimal("2,5")).toBe(2.5);
    expect(parseDecimal("3.99%")).toBe(3.99);
    expect(parseDecimal("0")).toBe(0);
  });

  it("rejeita inválidos", () => {
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal("-1")).toBeNull();
    expect(parseDecimal("1,234")).toBeNull();
  });
});
