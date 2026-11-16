import { describe, expect, it } from "vitest";

import {
  biggestLoss,
  businessDays,
  daySummary,
  daysInMonth,
  funnelRates,
  greeting,
  joinPt,
  niceTicks,
  relativeChange,
  revenuePace,
} from "./logic";

describe("greeting", () => {
  it("muda ao meio-dia e às 18h", () => {
    expect(greeting(6)).toBe("Bom dia");
    expect(greeting(12)).toBe("Boa tarde");
    expect(greeting(17)).toBe("Boa tarde");
    expect(greeting(18)).toBe("Boa noite");
  });
});

describe("dias úteis", () => {
  it("conta de segunda a sábado", () => {
    // Novembro de 2026 tem 5 domingos (1, 8, 15, 22, 29).
    expect(daysInMonth("2026-11-16")).toBe(30);
    expect(businessDays("2026-11", 1, 30)).toBe(25);
    expect(businessDays("2026-11", 1, 14)).toBe(12);
    expect(daysInMonth("2028-02-10")).toBe(29);
  });
});

describe("revenuePace", () => {
  const daily = [0, ...Array(13).fill(1000)];

  it("acumula, projeta pela média por dia útil e compara com a meta", () => {
    const r = revenuePace(daily, "2026-11-14", 25000);
    expect(r.accumulated).toHaveLength(14);
    expect(r.total).toBe(13000);
    expect(r.projection).toBe(27083); // 13000 / 12 × 25
    expect(r.paceToday).toBe(12000); // 25000 × 12 / 25
    expect(r.paceDelta).toBeCloseTo(13000 / 12000 - 1);
    expect(r.requiredPerDay).toBe(923); // (25000 − 13000) / 13 dias úteis restantes
    expect(r.bestDay).toBe(2);
    expect(r.lastDay).toBe(30);
  });

  it("sem meta não calcula ritmo", () => {
    const r = revenuePace(daily, "2026-11-14", null);
    expect(r.goal).toBeNull();
    expect(r.paceDelta).toBeNull();
    expect(r.requiredPerDay).toBeNull();
    expect(r.projection).toBe(27083);
  });

  it("antes do primeiro dia útil não projeta; meta batida pede zero por dia", () => {
    expect(revenuePace([], "2026-11-01", 1000).projection).toBeNull();
    expect(revenuePace([5000], "2026-11-02", 1000).requiredPerDay).toBe(0);
    expect(revenuePace([], "2026-11-02", 1000).bestDay).toBeNull();
  });
});

describe("relativeChange", () => {
  it("é nula com base zero", () => {
    expect(relativeChange(120, 100)).toBeCloseTo(0.2);
    expect(relativeChange(5, 0)).toBeNull();
  });
});

describe("funil", () => {
  const steps = [
    { label: "Leads", value: 64 },
    { label: "Avaliação marcada", value: 38 },
    { label: "Orçamento apresentado", value: 29 },
    { label: "Fechou tratamento", value: 17 },
  ];

  it("calcula a passagem de cada etapa", () => {
    const r = funnelRates(steps);
    expect(r[0]!.rate).toBeNull();
    expect(r[1]!.rate).toBeCloseTo(38 / 64);
    expect(r[3]!.share).toBeCloseTo(17 / 64);
  });

  it("acha a maior perda", () => {
    expect(biggestLoss(steps)).toEqual({ from: "Leads", to: "Avaliação marcada", lost: 26 });
    expect(biggestLoss([{ label: "a", value: 0 }, { label: "b", value: 0 }])).toBeNull();
  });
});

describe("daySummary", () => {
  it("escreve ritmo e pendências só quando há dado", () => {
    const s = daySummary({ paceDelta: 0.1, unconfirmedTomorrow: 5, stalledQuotes: 1, noShowRate: 0.2, pastAppointments: 40 });
    expect(s.pace).toEqual({ before: "O mês está ", strong: "10% acima do ritmo da meta" });
    expect(s.todos).toEqual([
      "5 consultas de amanhã ainda sem confirmação",
      "1 orçamento parado há mais de 20 dias",
      "taxa de faltas de 20% nos últimos 30 dias",
    ]);

    const empty = daySummary({ paceDelta: null, unconfirmedTomorrow: 0, stalledQuotes: null, noShowRate: 0.5, pastAppointments: 4 });
    expect(empty).toEqual({ pace: null, todos: [] });
    expect(daySummary({ paceDelta: -0.234, unconfirmedTomorrow: 0, stalledQuotes: 0, noShowRate: 0, pastAppointments: 0 }).pace?.strong).toBe(
      "23% abaixo do ritmo da meta",
    );
  });

  it("junta itens em português", () => {
    expect(joinPt(["a"])).toBe("a");
    expect(joinPt(["a", "b", "c"])).toBe("a, b e c");
  });
});

describe("niceTicks", () => {
  it("arredonda o topo do eixo", () => {
    expect(niceTicks(9_500_000)).toEqual([0, 2_500_000, 5_000_000, 7_500_000, 10_000_000]);
    expect(niceTicks(0)).toEqual([0, 1, 2, 3, 4]);
    expect(niceTicks(130)).toEqual([0, 50, 100, 150, 200]);
  });
});
