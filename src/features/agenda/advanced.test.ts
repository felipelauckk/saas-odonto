import { describe, expect, it } from "vitest";

import { fitsWaitlist, isLate, periodOf, seriesDates } from "./advanced";

describe("seriesDates", () => {
  it("semanal, quinzenal e mensal (fim de mês)", () => {
    expect(seriesDates("2030-01-28", "week", 3)).toEqual(["2030-01-28", "2030-02-04", "2030-02-11"]);
    expect(seriesDates("2030-01-28", "2weeks", 2)).toEqual(["2030-01-28", "2030-02-11"]);
    expect(seriesDates("2030-01-31", "month", 3)).toEqual(["2030-01-31", "2030-02-28", "2030-03-31"]);
  });
});

describe("lista de espera", () => {
  const slot = { professionalId: "ana", unitId: "u1", startMin: 14 * 60 };
  it("respeita unidade, profissional e período", () => {
    expect(fitsWaitlist({ professionalId: null, unitId: "u1", period: "any" }, slot)).toBe(true);
    expect(fitsWaitlist({ professionalId: "ana", unitId: "u1", period: "afternoon" }, slot)).toBe(true);
    expect(fitsWaitlist({ professionalId: "beto", unitId: "u1", period: "any" }, slot)).toBe(false);
    expect(fitsWaitlist({ professionalId: null, unitId: "u2", period: "any" }, slot)).toBe(false);
    expect(fitsWaitlist({ professionalId: null, unitId: "u1", period: "morning" }, slot)).toBe(false);
  });

  it("classifica o período pelo horário", () => {
    expect(periodOf(8 * 60)).toBe("morning");
    expect(periodOf(12 * 60)).toBe("afternoon");
    expect(periodOf(18 * 60 + 30)).toBe("evening");
  });
});

describe("atrasado", () => {
  const startsAt = "2030-03-04T12:00:00.000Z";
  const t = (min: number) => Date.parse(startsAt) + min * 60_000;
  it("só depois de 10 minutos, sem chegada, e só para agendada ou confirmada", () => {
    expect(isLate({ status: "scheduled", startsAt, arrivedAt: null }, t(10))).toBe(false);
    expect(isLate({ status: "scheduled", startsAt, arrivedAt: null }, t(11))).toBe(true);
    expect(isLate({ status: "confirmed", startsAt, arrivedAt: null }, t(30))).toBe(true);
    expect(isLate({ status: "confirmed", startsAt, arrivedAt: startsAt }, t(30))).toBe(false);
    expect(isLate({ status: "arrived", startsAt, arrivedAt: null }, t(30))).toBe(false);
    expect(isLate({ status: "canceled", startsAt, arrivedAt: null }, t(30))).toBe(false);
  });
});
