import { describe, expect, it } from "vitest";

import { actualOf, conversion, emptyMonth, monthsBack, nextMonth, prevMonth, progress, shortMonth } from "./logic";

describe("metas e indicadores", () => {
  it("meses", () => {
    expect(monthsBack("2026-02", 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(nextMonth("2026-12")).toBe("2027-01");
    expect(prevMonth("2026-01")).toBe("2025-12");
    expect(shortMonth("2026-11")).toBe("nov/26");
  });

  it("realizado, conversão e progresso", () => {
    const s = { ...emptyMonth("2026-11"), revenue: 500000, issued: 4, issuedApproved: 1 };
    expect(conversion(s)).toBe(0.25);
    expect(actualOf(s, "revenue")).toBe(500000);
    expect(progress(500000, 1000000)).toBe(0.5);
    expect(progress(10, undefined)).toBeNull();
    expect(progress(null, 10)).toBeNull();
    expect(conversion(emptyMonth("2026-11"))).toBeNull();
  });
});
