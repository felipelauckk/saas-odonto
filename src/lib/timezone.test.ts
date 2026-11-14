import { describe, expect, it } from "vitest";

import {
  addDays,
  formatLongDate,
  minutesToTime,
  startOfWeek,
  timeToMinutes,
  utcToZoned,
  weekdayOf,
  zonedToUtc,
} from "./timezone";

describe("zonedToUtc / utcToZoned", () => {
  it("converte o horário de São Paulo (UTC-3) para UTC", () => {
    expect(zonedToUtc("2026-11-14", "09:30").toISOString()).toBe("2026-11-14T12:30:00.000Z");
    expect(zonedToUtc("2026-11-14", "22:00").toISOString()).toBe("2026-11-15T01:00:00.000Z");
  });

  it("volta para o horário de parede", () => {
    expect(utcToZoned("2026-11-15T01:00:00.000Z")).toEqual({ date: "2026-11-14", time: "22:00", minutes: 1320 });
  });

  it("ida e volta mantém data e hora", () => {
    for (const [date, time] of [["2026-01-01", "00:00"], ["2026-06-30", "23:45"], ["2027-02-28", "12:15"]] as const) {
      expect(utcToZoned(zonedToUtc(date, time))).toMatchObject({ date, time });
    }
  });

  it("respeita o horário de verão de 2018 (UTC-2)", () => {
    expect(zonedToUtc("2018-12-01", "10:00").toISOString()).toBe("2018-12-01T12:00:00.000Z");
  });
});

describe("datas", () => {
  it("soma dias atravessando mês e ano", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("acha a segunda-feira da semana", () => {
    expect(weekdayOf("2026-11-14")).toBe(6);
    expect(startOfWeek("2026-11-14")).toBe("2026-11-09");
    expect(startOfWeek("2026-11-15")).toBe("2026-11-09"); // domingo
    expect(startOfWeek("2026-11-09")).toBe("2026-11-09");
  });

  it("converte minutos", () => {
    expect(timeToMinutes("09:30")).toBe(570);
    expect(minutesToTime(570)).toBe("09:30");
  });

  it("formata a data por extenso", () => {
    expect(formatLongDate("2026-11-14")).toBe("sábado, 14 de novembro");
  });
});
