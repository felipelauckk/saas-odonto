import { describe, expect, it } from "vitest";

import { firstName, renderTemplate, toWhatsAppNumber } from "./render";

describe("renderTemplate", () => {
  it("preenche as variáveis", () => {
    expect(
      renderTemplate("Olá, {{paciente}}! Consulta {{data}} às {{ hora }} com {{profissional}}.", {
        paciente: "Ana",
        clinica: "Sorriso",
        data: "15/11",
        hora: "09:00",
        profissional: "Dra. Bia",
      }),
    ).toBe("Olá, Ana! Consulta 15/11 às 09:00 com Dra. Bia.");
  });

  it("variável ausente some sem deixar espaço duplo", () => {
    expect(renderTemplate("Oi {{paciente}} {{desconhecida}} tudo bem", { paciente: "Ana", clinica: "X" })).toBe("Oi Ana tudo bem");
  });
});

describe("toWhatsAppNumber", () => {
  it("normaliza telefones brasileiros", () => {
    expect(toWhatsAppNumber("(11) 98888-7777")).toBe("5511988887777");
    expect(toWhatsAppNumber("5511988887777")).toBe("5511988887777");
    expect(toWhatsAppNumber("1133334444")).toBe("551133334444");
  });

  it("recusa números inválidos", () => {
    expect(toWhatsAppNumber("98888-7777")).toBeNull();
    expect(toWhatsAppNumber(null)).toBeNull();
  });

  it("usa o primeiro nome", () => {
    expect(firstName("  Ana Paula Souza ")).toBe("Ana");
  });
});
