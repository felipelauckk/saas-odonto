import { describe, expect, it } from "vitest";

import { dueUrgency, lastMonths, margin, monthlyFlow, shortMoney } from "./overview";

describe("visão geral do financeiro", () => {
  it("lista os últimos meses atravessando a virada do ano", () => {
    expect(lastMonths("2026-02-10", 4)).toEqual(["2025-11-01", "2025-12-01", "2026-01-01", "2026-02-01"]);
  });

  it("monta os 6 meses com o resultado e marca o mês corrente", () => {
    const months = monthlyFlow(
      [
        { bucket: "2026-10-01", realizedIn: 8_800_000, realizedOut: 6_000_000 },
        { bucket: "2026-11-01", realizedIn: 100_000, realizedOut: 300_000 },
      ],
      "2026-11-16",
    );
    expect(months).toHaveLength(6);
    expect(months[0]).toEqual({ month: "2026-06-01", inCents: 0, outCents: 0, resultCents: 0, partial: false });
    expect(months[4]!.resultCents).toBe(2_800_000);
    expect(months[5]).toMatchObject({ resultCents: -200_000, partial: true });
  });

  it("calcula a margem e escreve valores curtos", () => {
    expect(margin(100, 64)).toBeCloseTo(0.36);
    expect(margin(0, 10)).toBeNull();
    expect(shortMoney(1_768_000)).toBe("+R$ 18 mil");
    expect(shortMoney(-120_000)).toBe("−R$ 1,2 mil");
    expect(shortMoney(85_000)).toBe("+R$ 850");
  });

  it("classifica o vencimento", () => {
    expect(dueUrgency("2026-11-15", "2026-11-16")).toBe("late");
    expect(dueUrgency("2026-11-18", "2026-11-16")).toBe("soon");
    expect(dueUrgency("2026-11-20", "2026-11-16")).toBe("ok");
  });
});
