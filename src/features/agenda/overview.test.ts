import { describe, expect, it } from "vitest";

import { initials, monthOccupancy, monthWeeks, occupancy, occupancyLevel, pickFreedSlot, weekTitle } from "./overview";

const h = (hh: number, mm = 0) => hh * 60 + mm;

describe("occupancy", () => {
  const working = [
    { startMin: h(8), endMin: h(12) },
    { startMin: h(13), endMin: h(17) },
  ];

  it("conta o tempo marcado dentro do expediente, sem faltas e desmarcações", () => {
    const r = occupancy(
      [
        { startMin: h(8), endMin: h(10), status: "confirmed" },
        { startMin: h(11, 30), endMin: h(13, 30), status: "done" }, // metade no almoço
        { startMin: h(14), endMin: h(16), status: "no_show" },
        { startMin: h(15), endMin: h(16), status: "canceled" },
      ],
      working,
    );
    expect(r).toBeCloseTo(3 / 8); // 2h + 30min + 30min de 8h
  });

  it("não conta duas vezes consultas sobrepostas e é nula sem expediente", () => {
    expect(
      occupancy(
        [
          { startMin: h(8), endMin: h(9), status: "scheduled" },
          { startMin: h(8, 30), endMin: h(9, 30), status: "scheduled" },
        ],
        [{ startMin: h(8), endMin: h(10) }],
      ),
    ).toBeCloseTo(0.75);
    expect(occupancy([], null)).toBeNull();
    expect(occupancy([], [])).toBeNull();
  });

  it("tem quatro tons", () => {
    expect([null, 0, 0.3, 0.6, 0.9].map(occupancyLevel)).toEqual([0, 0, 1, 2, 3]);
  });
});

describe("mini calendário", () => {
  it("começa no domingo e completa a última semana", () => {
    const weeks = monthWeeks("2026-11"); // 1º de novembro de 2026 é domingo
    expect(weeks[0]![0]).toBe("2026-11-01");
    expect(weeks.at(-1)).toEqual(["2026-11-29", "2026-11-30", null, null, null, null, null]);
    expect(monthWeeks("2026-12")[0]!.slice(0, 3)).toEqual([null, null, "2026-12-01"]);
  });

  it("calcula a ocupação de cada dia pelo expediente da semana", () => {
    const schedules = [
      { professionalId: "a", weekday: 1, startMin: h(8), endMin: h(12) },
      { professionalId: "b", weekday: 1, startMin: h(8), endMin: h(12) },
    ];
    const occ = monthOccupancy(
      "2026-11",
      [{ date: "2026-11-02", professionalId: "a", status: "confirmed", startMin: h(8), endMin: h(12) }],
      schedules,
    );
    expect(occ.get("2026-11-02")).toBeCloseTo(0.5); // segunda: 4h de 8h
    expect(occ.get("2026-11-09")).toBe(0);
    expect(occ.get("2026-11-03")).toBeNull(); // terça sem expediente
  });
});

describe("textos", () => {
  it("monta o título da semana", () => {
    expect(weekTitle("2026-11-15", "2026-11-21")).toBe("15 a 21 de novembro");
    expect(weekTitle("2026-11-29", "2026-12-05")).toBe("29 de nov. a 5 de dez.");
  });

  it("tira Dr./Dra. das iniciais", () => {
    expect(initials("Dra. Helena Martins")).toBe("HM");
    expect(initials("Paulo")).toBe("P");
  });
});

describe("pickFreedSlot", () => {
  const slot = (id: string, date: string, start: number) => ({ id, date, unitId: "u", professionalId: "p", startMin: start, endMin: start + 60 });
  const waitlist = [
    { id: "w1", unitId: "u", professionalId: null, period: "afternoon" as const, patientName: "Ana", notes: null },
    { id: "w2", unitId: "u", professionalId: "p", period: "any" as const, patientName: "Bia", notes: null },
    { id: "w3", unitId: "outra", professionalId: null, period: "any" as const, patientName: "Caio", notes: null },
  ];

  it("pula horário já ocupado e escolhe o próximo com alguém da lista", () => {
    const r = pickFreedSlot(
      [slot("c1", "2026-11-16", h(9)), slot("c2", "2026-11-16", h(14))],
      [{ date: "2026-11-16", professionalId: "p", startMin: h(9), endMin: h(9, 30) }],
      waitlist,
    );
    expect(r?.slot.id).toBe("c2");
    expect(r?.matches.map((m) => m.patientName)).toEqual(["Ana", "Bia"]);
  });

  it("sem ninguém que caiba, não mostra nada", () => {
    expect(pickFreedSlot([slot("c1", "2026-11-16", h(9))], [], [waitlist[0]!, waitlist[2]!])).toBeNull();
  });
});
