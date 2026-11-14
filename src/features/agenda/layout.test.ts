import { describe, expect, it } from "vitest";

import { computeLanes, minutesFromOffset, snap, visibleRange } from "./layout";

describe("visibleRange", () => {
  it("usa 8h–18h quando não há nada", () => {
    expect(visibleRange([])).toEqual({ startMin: 480, endMin: 1080 });
  });

  it("estende para cobrir expediente e consultas, em horas cheias", () => {
    expect(visibleRange([{ startMin: 7 * 60 + 30, endMin: 9 * 60 }, { startMin: 18 * 60, endMin: 20 * 60 + 15 }])).toEqual({
      startMin: 420,
      endMin: 1260,
    });
  });
});

describe("computeLanes", () => {
  it("itens sem sobreposição ficam numa faixa só", () => {
    const lanes = computeLanes([
      { id: "a", startMin: 540, endMin: 600 },
      { id: "b", startMin: 600, endMin: 660 },
    ]);
    expect(lanes.get("a")).toEqual({ lane: 0, lanes: 1 });
    expect(lanes.get("b")).toEqual({ lane: 0, lanes: 1 });
  });

  it("sobrepostos ficam lado a lado e reaproveitam faixas livres", () => {
    const lanes = computeLanes([
      { id: "a", startMin: 540, endMin: 660 },
      { id: "b", startMin: 570, endMin: 600 },
      { id: "c", startMin: 600, endMin: 630 },
    ]);
    expect(lanes.get("a")).toEqual({ lane: 0, lanes: 2 });
    expect(lanes.get("b")).toEqual({ lane: 1, lanes: 2 });
    expect(lanes.get("c")).toEqual({ lane: 1, lanes: 2 });
  });
});

describe("snap e posição", () => {
  it("encaixa de 15 em 15", () => {
    expect(snap(37, 15)).toBe(30);
    expect(snap(38, 15)).toBe(45);
  });

  it("converte pixels em minuto do dia", () => {
    // 88px por hora, grade começando às 8h: 132px = 1h30 → 9h30.
    expect(minutesFromOffset(132, 88, 480, 15)).toBe(570);
  });
});
