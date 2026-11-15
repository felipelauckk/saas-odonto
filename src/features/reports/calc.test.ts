import { describe, expect, it } from "vitest";

import { ageBand, allocate, birthdayInRange, debtBucket, overlapMinutes, unionMinutes } from "./calc";

describe("relatórios: cálculos", () => {
  it("faixa etária por anos completos", () => {
    expect(ageBand("2010-11-16", "2026-11-15")).toBe("13 a 17");
    expect(ageBand("2008-11-15", "2026-11-15")).toBe("18 a 29");
    expect(ageBand(null, "2026-11-15")).toBe("Sem data de nascimento");
  });

  it("idade da dívida", () => {
    expect([1, 30, 31, 60, 61, 90, 91].map(debtBucket)).toEqual(["d30", "d30", "d60", "d60", "d90", "d90", "d90plus"]);
  });

  it("aniversário no período, inclusive virando o ano e 29/02", () => {
    expect(birthdayInRange("1990-12-30", "2026-12-20", "2027-01-05")).toBe("2026-12-30");
    expect(birthdayInRange("1990-01-02", "2026-12-20", "2027-01-05")).toBe("2027-01-02");
    expect(birthdayInRange("1992-02-29", "2026-02-01", "2026-02-28")).toBe("2026-02-28");
    expect(birthdayInRange("1990-06-01", "2026-12-20", "2027-01-05")).toBeNull();
  });

  it("intervalos: união e sobreposição", () => {
    expect(unionMinutes([{ start: 0, end: 60 }, { start: 30, end: 90 }, { start: 120, end: 150 }])).toBe(120);
    expect(overlapMinutes({ start: 0, end: 60 }, { start: 30, end: 120 })).toBe(30);
    expect(overlapMinutes({ start: 0, end: 10 }, { start: 30, end: 120 })).toBe(0);
  });

  it("rateio fecha os centavos", () => {
    const r = allocate(10000, [{ key: "a", weight: 1 }, { key: "b", weight: 1 }, { key: "c", weight: 1 }]);
    expect([...r.values()]).toEqual([3333, 3333, 3334]);
    expect(allocate(500, [])).toEqual(new Map());
  });
});
