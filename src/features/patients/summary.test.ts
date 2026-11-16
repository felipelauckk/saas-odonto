import { describe, expect, it } from "vitest";

import { initials } from "@/lib/initials";

import { lastVisitLabel, nextVisitLabel, patientSince } from "./summary";

// 16/11/2026, 09:00 em São Paulo (segunda-feira).
const now = new Date("2026-11-16T12:00:00Z");

describe("faixa de resumo", () => {
  it("escreve a próxima consulta em relação a hoje", () => {
    expect(nextVisitLabel("2026-11-16T17:30:00Z", now)).toBe("Hoje · 14:30");
    expect(nextVisitLabel("2026-11-17T13:00:00Z", now)).toBe("Amanhã · 10:00");
    expect(nextVisitLabel("2026-11-19T13:00:00Z", now)).toBe("Qui, 19/11 · 10:00");
    expect(nextVisitLabel("2027-01-04T13:00:00Z", now)).toBe("Seg, 04/01/2027 · 10:00");
  });

  it("escreve a última visita com o tipo", () => {
    expect(lastVisitLabel("2026-11-02T13:00:00Z", "Avaliação", now)).toBe("02/11 · Avaliação");
    expect(lastVisitLabel("2025-12-20T13:00:00Z", null, now)).toBe("20/12/2025");
  });

  it("usa o fuso de São Paulo para o mês de cadastro", () => {
    expect(patientSince("2024-03-01T02:00:00Z")).toBe("fev/2024");
    expect(patientSince("2024-03-10T15:00:00Z")).toBe("mar/2024");
  });

  it("monta as iniciais sem título e sem conectivos", () => {
    expect(initials("Mariana Costa")).toBe("MC");
    expect(initials("Dra. Helena da Silva Martins")).toBe("HM");
    expect(initials("João da Silva")).toBe("JS");
    expect(initials("Paulo")).toBe("P");
  });
});
