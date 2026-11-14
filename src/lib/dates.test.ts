import { describe, expect, it } from "vitest";

import { ageFromBirthDate, formatIsoDate, todayIso } from "./dates";

describe("todayIso", () => {
  it("usa o fuso de São Paulo", () => {
    // 02:00 UTC do dia 15 ainda é dia 14 em São Paulo (UTC-3).
    expect(todayIso(new Date("2026-11-15T02:00:00Z"))).toBe("2026-11-14");
    expect(todayIso(new Date("2026-11-15T04:00:00Z"))).toBe("2026-11-15");
  });
});

describe("ageFromBirthDate", () => {
  it("conta anos completos", () => {
    expect(ageFromBirthDate("2008-11-14", "2026-11-14")).toBe(18);
    expect(ageFromBirthDate("2008-11-15", "2026-11-14")).toBe(17);
    expect(ageFromBirthDate("1990-01-01", "2026-11-14")).toBe(36);
  });

  it("trata 29 de fevereiro", () => {
    expect(ageFromBirthDate("2008-02-29", "2026-02-28")).toBe(17);
    expect(ageFromBirthDate("2008-02-29", "2026-03-01")).toBe(18);
  });
});

describe("formatIsoDate", () => {
  it("formata sem mudar o dia", () => {
    expect(formatIsoDate("1990-05-03")).toBe("03/05/1990");
  });
});
