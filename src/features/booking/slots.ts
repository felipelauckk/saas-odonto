import { addDays, timeToMinutes, weekdayOf, zonedToUtc } from "@/lib/timezone";

export type Busy = { start: number; end: number }; // ms desde a época
export type Schedule = { professionalId: string; weekday: number; start: string; end: string };
export type Slot = { date: string; time: string; professionalId: string; startsAt: string; endsAt: string };

/**
 * Horários livres para agendamento online: dentro do expediente de cada
 * profissional, sem sobrepor consultas ou bloqueios, a cada `durationMin`,
 * respeitando a antecedência mínima e o limite de dias à frente.
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
  const step = input.durationMin * 60_000;
  for (let i = 0; i < input.days; i++) {
    const date = addDays(input.from, i);
    const weekday = weekdayOf(date);
    for (const s of input.schedules.filter((x) => x.weekday === weekday)) {
      const busy = [...(input.busyByProfessional.get(s.professionalId) ?? []), ...input.unitBusy];
      const dayStart = zonedToUtc(date, s.start).getTime();
      const dayEnd = zonedToUtc(date, s.end).getTime();
      for (let t = dayStart; t + step <= dayEnd; t += step) {
        if (t < earliest) continue;
        if (busy.some((b) => b.start < t + step && b.end > t)) continue;
        const minutes = timeToMinutes(s.start) + Math.round((t - dayStart) / 60_000);
        out.push({
          date,
          time: `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`,
          professionalId: s.professionalId,
          startsAt: new Date(t).toISOString(),
          endsAt: new Date(t + step).toISOString(),
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
