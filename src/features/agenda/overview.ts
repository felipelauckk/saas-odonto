/**
 * Contas da visão geral da agenda (ocupação, mini calendário, vaga liberada),
 * sem acesso ao banco. Datas "AAAA-MM-DD" e minutos do dia em São Paulo.
 */
import { fitsWaitlist, type Period } from "./advanced";
import { FREEING_STATUSES, type AppointmentStatus } from "./labels";

type Interval = { startMin: number; endMin: number };

function overlap(a: Interval, b: Interval) {
  return Math.max(0, Math.min(a.endMin, b.endMin) - Math.max(a.startMin, b.startMin));
}

/**
 * Ocupação = minutos com consulta (sem faltas e desmarcações) dentro do
 * expediente ÷ minutos de expediente. Nulo sem expediente no dia.
 */
export function occupancy(appointments: (Interval & { status: AppointmentStatus })[], working: Interval[] | null): number | null {
  if (!working?.length) return null;
  const total = working.reduce((s, w) => s + (w.endMin - w.startMin), 0);
  if (total <= 0) return null;
  // Consultas sobrepostas contam uma vez só: soma minuto a minuto por expediente.
  const busy = appointments.filter((a) => !FREEING_STATUSES.includes(a.status)).sort((a, b) => a.startMin - b.startMin);
  let booked = 0;
  for (const w of working) {
    let cursor = w.startMin;
    for (const a of busy) {
      const start = Math.max(a.startMin, cursor);
      const end = Math.min(a.endMin, w.endMin);
      if (end > start) {
        booked += end - start;
        cursor = end;
      }
    }
  }
  return Math.min(1, booked / total);
}

/** Tom do dia no mini calendário: 0 livre ou sem expediente, 1 até 40%, 2 até 75%, 3 acima. */
export function occupancyLevel(ratio: number | null): 0 | 1 | 2 | 3 {
  if (ratio === null || ratio <= 0) return 0;
  if (ratio <= 0.4) return 1;
  if (ratio <= 0.75) return 2;
  return 3;
}

function weekdayOf(date: string) {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

function daysIn(month: string) {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Dias do mês em semanas de domingo a sábado (null = fora do mês). */
export function monthWeeks(month: string): (string | null)[][] {
  const cells: (string | null)[] = Array(weekdayOf(`${month}-01`)).fill(null);
  for (let d = 1; d <= daysIn(month); d++) cells.push(`${month}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}

/**
 * Ocupação de cada dia do mês: minutos de consulta ÷ minutos de expediente de
 * todos os profissionais naquele dia da semana.
 */
export function monthOccupancy(
  month: string,
  appointments: (Interval & { date: string; professionalId: string; status: AppointmentStatus })[],
  schedules: (Interval & { professionalId: string; weekday: number })[],
): Map<string, number | null> {
  const result = new Map<string, number | null>();
  for (let d = 1; d <= daysIn(month); d++) {
    const date = `${month}-${String(d).padStart(2, "0")}`;
    const weekday = weekdayOf(date);
    const byPro = new Map<string, Interval[]>();
    for (const s of schedules) {
      if (s.weekday !== weekday) continue;
      byPro.set(s.professionalId, [...(byPro.get(s.professionalId) ?? []), s]);
    }
    let capacity = 0;
    let booked = 0;
    for (const [pro, working] of byPro) {
      const minutes = working.reduce((s, w) => s + (w.endMin - w.startMin), 0);
      const ratio = occupancy(
        appointments.filter((a) => a.date === date && a.professionalId === pro),
        working,
      );
      capacity += minutes;
      booked += (ratio ?? 0) * minutes;
    }
    result.set(date, capacity > 0 ? booked / capacity : null);
  }
  return result;
}

const monthLong = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" });
const monthShort = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" });

/** "16 a 22 de novembro" ou "30 de nov. a 6 de dez." */
export function weekTitle(first: string, last: string): string {
  const d = (s: string) => Number(s.slice(8, 10));
  const date = (s: string) => new Date(`${s}T00:00:00Z`);
  if (first.slice(0, 7) === last.slice(0, 7)) return `${d(first)} a ${d(last)} de ${monthLong.format(date(last))}`;
  return `${d(first)} de ${monthShort.format(date(first))} a ${d(last)} de ${monthShort.format(date(last))}`;
}

export { initials } from "@/lib/initials";

export type FreedCandidate = Interval & {
  id: string;
  date: string;
  unitId: string;
  professionalId: string;
};

export type WaitlistEntry = { id: string; unitId: string; professionalId: string | null; period: Period; patientName: string; notes: string | null };

/**
 * A vaga liberada mais próxima: consulta desmarcada cujo horário continua livre
 * para o mesmo profissional e em que alguém da lista de espera cabe.
 * `candidates` já vêm em ordem de horário e só no futuro.
 */
export function pickFreedSlot(
  candidates: FreedCandidate[],
  busy: (Interval & { date: string; professionalId: string })[],
  waitlist: WaitlistEntry[],
  max = 3,
): { slot: FreedCandidate; matches: WaitlistEntry[] } | null {
  for (const slot of candidates) {
    const taken = busy.some((b) => b.date === slot.date && b.professionalId === slot.professionalId && overlap(b, slot) > 0);
    if (taken) continue;
    const matches = waitlist.filter((w) =>
      fitsWaitlist({ professionalId: w.professionalId, unitId: w.unitId, period: w.period }, { professionalId: slot.professionalId, unitId: slot.unitId, startMin: slot.startMin }),
    );
    if (matches.length) return { slot, matches: matches.slice(0, max) };
  }
  return null;
}
