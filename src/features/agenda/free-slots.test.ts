import { describe, expect, it } from "vitest";

import { timeToMinutes, zonedToUtc } from "@/lib/timezone";

import { clipToDay, groupByPeriod, OUTSIDE_HOURS, slotStarts } from "./free-slots";

const m = timeToMinutes;
const times = (starts: number[]) => starts.map((s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`);

describe("agenda: horários livres", () => {
  const morning = [{ startMin: m("08:00"), endMin: m("10:00") }];

  it("a cada 15 minutos, a consulta inteira cabe no expediente", () => {
    expect(times(slotStarts({ windows: morning, busy: [], durationMin: 45, stepMin: 15 }))).toEqual([
      "08:00",
      "08:15",
      "08:30",
      "08:45",
      "09:00",
      "09:15",
    ]);
  });

  it("consulta e bloqueio existentes nunca são oferecidos (nem encostando)", () => {
    const busy = [
      { startMin: m("08:30"), endMin: m("09:00") }, // consulta
      { startMin: m("09:30"), endMin: m("09:45") }, // bloqueio
    ];
    const starts = slotStarts({ windows: morning, busy, durationMin: 30, stepMin: 15 });
    // 09:45 + 30 min passaria das 10:00 (fim do expediente).
    expect(times(starts)).toEqual(["08:00", "09:00"]);
    for (const s of starts) for (const b of busy) expect(s < b.endMin && s + 30 > b.startMin).toBe(false);
  });

  it("mudar a duração recalcula", () => {
    const busy = [{ startMin: m("09:00"), endMin: m("09:30") }];
    expect(times(slotStarts({ windows: morning, busy, durationMin: 60, stepMin: 15 }))).toEqual(["08:00"]);
    expect(times(slotStarts({ windows: morning, busy, durationMin: 15, stepMin: 15 }))).toContain("08:45");
  });

  it("fora do expediente não aparece; a faixa extra libera 6h às 22h", () => {
    expect(slotStarts({ windows: [], busy: [], durationMin: 30, stepMin: 15 })).toEqual([]);
    const all = slotStarts({ windows: [OUTSIDE_HOURS], busy: [], durationMin: 30, stepMin: 15 });
    expect(times(all)[0]).toBe("06:00");
    expect(times(all).at(-1)).toBe("21:30");
  });

  it("hoje: o que já passou sai", () => {
    expect(times(slotStarts({ windows: morning, busy: [], durationMin: 30, stepMin: 15, earliestMin: m("09:10") }))).toEqual(["09:15", "09:30"]);
  });

  it("separa em manhã, tarde e noite", () => {
    const groups = groupByPeriod([m("11:45"), m("12:00"), m("17:45"), m("18:00")]);
    expect(groups.map((g) => [g.label, g.times])).toEqual([
      ["Manhã", ["11:45"]],
      ["Tarde", ["12:00", "17:45"]],
      ["Noite", ["18:00"]],
    ]);
  });

  it("recorta intervalos ao dia", () => {
    const day = zonedToUtc("2030-03-04", "00:00").getTime();
    const prev = zonedToUtc("2030-03-03", "22:00").getTime();
    expect(clipToDay(prev, zonedToUtc("2030-03-04", "01:00").getTime(), day)).toEqual({ startMin: 0, endMin: 60 });
    expect(clipToDay(prev, day, day)).toBeNull();
  });
});
