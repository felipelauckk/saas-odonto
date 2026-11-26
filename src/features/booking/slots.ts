import { clipToDay, slotStarts, type Range } from "@/features/agenda/free-slots";
import { addDays, minutesToTime, timeToMinutes, weekdayOf, zonedToUtc } from "@/lib/timezone";

export type Busy = { start: number; end: number }; // ms desde a época
export type Schedule = { professionalId: string; weekday: number; start: string; end: string };
export type Slot = { date: string; time: string; professionalId: string; startsAt: string; endsAt: string };

/**
 * Horários livres para agendamento online: dentro do expediente de cada
 * profissional, sem sobrepor consultas ou bloqueios, a cada `durationMin`,
 * respeitando a antecedência mínima e o limite de dias à frente.
 * A conta de cada dia é a mesma da agenda (`slotStarts`).
 */
export function freeSlots(input: {
  schedules: Schedule[];
  busyByProfessional: Map<string, Busy[]>;
  /** Bloqueios da unidade inteira (valem para todos). */
  unitBusy: Busy[];
  durationMin: number;
  from: string; // primeiro dia (AAAA-MM-DD, São Paulo)
  days: number;
  now: number;
  minNoticeHours: number;
}): Slot[] {
  const out: Slot[] = [];
  const earliest = input.now + input.minNoticeHours * 3_600_000;
  for (let i = 0; i < input.days; i++) {
    const date = addDays(input.from, i);
    const weekday = weekdayOf(date);
    const dayStart = zonedToUtc(date, "00:00").getTime();
    for (const s of input.schedules.filter((x) => x.weekday === weekday)) {
      const busy = [...(input.busyByProfessional.get(s.professionalId) ?? []), ...input.unitBusy]
        .map((b) => clipToDay(b.start, b.end, dayStart))
        .filter((b): b is Range => b !== null);
      const starts = slotStarts({
        windows: [{ startMin: timeToMinutes(s.start), endMin: timeToMinutes(s.end) }],
        busy,
        durationMin: input.durationMin,
        stepMin: input.durationMin,
        earliestMin: Math.ceil((earliest - dayStart) / 60_000),
      });
      for (const minutes of starts) {
        const t = dayStart + minutes * 60_000;
        out.push({
          date,
          time: minutesToTime(minutes),
          professionalId: s.professionalId,
          startsAt: new Date(t).toISOString(),
          endsAt: new Date(t + input.durationMin * 60_000).toISOString(),
        });
      }
    }
  }
  return out.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.professionalId.localeCompare(b.professionalId));
}

/** "Qualquer profissional": um horário por início, escolhendo o primeiro profissional livre. */
export function mergeAnyProfessional(slots: Slot[]): Slot[] {
  const seen = new Set<string>();
  return slots.filter((s) => (seen.has(s.startsAt) ? false : (seen.add(s.startsAt), true)));
}

/** Telefone com DDD → só dígitos, ou nulo se inválido. */
export function normalizePhone(value: string): string | null {
  const d = value.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  return /^[1-9]{2}9?\d{8}$/.test(d) ? d : null;
}
