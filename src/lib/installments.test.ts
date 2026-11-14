import { describe, expect, it } from "vitest";

import { addMonths, splitInstallments } from "./installments";

describe("addMonths", () => {
  it("prende no fim do mês", () => {
    expect(addMonths("2030-01-31", 1)).toBe("2030-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2030-01-31", 2)).toBe("2030-03-31");
    expect(addMonths("2030-11-15", 3)).toBe("2031-02-15");
  });
});

describe("splitInstallments", () => {
  it("soma exatamente o total, com a sobra na primeira", () => {
    const parts = splitInstallments(115000, 3, "2030-01-31");
    expect(parts.map((p) => p.amountCents)).toEqual([38334, 38333, 38333]);
    expect(parts.reduce((s, p) => s + p.amountCents, 0)).toBe(115000);
    expect(parts.map((p) => p.dueDate)).toEqual(["2030-01-31", "2030-02-28", "2030-03-31"]);
  });

  it("à vista e valor zero", () => {
    expect(splitInstallments(5000, 1, "2030-05-10")).toEqual([{ number: 1, amountCents: 5000, dueDate: "2030-05-10" }]);
    expect(splitInstallments(0, 3, "2030-05-10")).toEqual([]);
  });
});
