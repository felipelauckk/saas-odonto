import { describe, expect, it } from "vitest";

import { zonedToUtc } from "@/lib/timezone";

import { freeSlots, mergeAnyProfessional, normalizePhone } from "./slots";

const day = "2030-03-04"; // segunda-feira
const t = (time: string) => zonedToUtc(day, time).getTime();

describe("agendamento online: horários livres", () => {
  const base = {
    schedules: [
      { professionalId: "ana", weekday: 1, start: "08:00", end: "10:00" },
      { professionalId: "beto", weekday: 1, start: "09:00", end: "10:00" },
    ],
    unitBusy: [],
    durationMin: 30,
    from: day,
    days: 1,
    minNoticeHours: 2,
  };

  it("expediente menos consultas e bloqueios, a cada duração", () => {
    const slots = freeSlots({ ...base, busyByProfessional: new Map([["ana", [{ start: t("08:30"), end: t("09:15") }]]]), now: t("05:00") });
    expect(slots.filter((s) => s.professionalId === "ana").map((s) => s.time)).toEqual(["08:00", "09:30"]);
    expect(slots.filter((s) => s.professionalId === "beto").map((s) => s.time)).toEqual(["09:00", "09:30"]);
  });

  it("antecedência mínima e bloqueio da unidade", () => {
    const slots = freeSlots({ ...base, unitBusy: [{ start: t("09:30"), end: t("10:00") }], busyByProfessional: new Map(), now: t("06:45") });
    // Antes de 08:45 não pode; 09:30 bloqueado para todos.
    expect(slots.map((s) => `${s.professionalId} ${s.time}`)).toEqual(["ana 09:00", "beto 09:00"]);
    expect(mergeAnyProfessional(slots).map((s) => s.time)).toEqual(["09:00"]);
  });

  it("dia sem expediente não tem horário", () => {
    expect(freeSlots({ ...base, from: "2030-03-03", busyByProfessional: new Map(), now: 0 })).toEqual([]);
  });

  it("telefone", () => {
    expect(normalizePhone("(11) 98888-7777")).toBe("11988887777");
    expect(normalizePhone("+55 11 98888-7777")).toBe("11988887777");
    expect(normalizePhone("123")).toBeNull();
  });
});
