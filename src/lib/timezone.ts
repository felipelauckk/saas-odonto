import { APP_TIME_ZONE } from "./format";

/**
 * Conversões entre o horário de parede de São Paulo ("2026-11-14", "09:30")
 * e instantes UTC. Funciona mesmo se o horário de verão voltar a existir,
 * porque o deslocamento é calculado pelo Intl para cada instante.
 */

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function zonedParts(date: Date) {
  const parts = Object.fromEntries(partsFormatter.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** Diferença (ms) entre o horário de São Paulo e UTC num instante. */
function offsetMs(date: Date): number {
  const p = zonedParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** "2026-11-14" + "09:30" em São Paulo → Date (instante UTC). */
export function zonedToUtc(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const [hh, mm] = time.split(":").map(Number) as [number, number];
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = guess - offsetMs(new Date(guess));
  // Segunda passada acerta casos na virada de horário de verão.
  return new Date(guess - offsetMs(new Date(first)));
}

/** Instante → { date: "AAAA-MM-DD", time: "HH:MM", minutes } em São Paulo. */
export function utcToZoned(value: Date | string) {
  const p = zonedParts(typeof value === "string" ? new Date(value) : value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
    time: `${pad(p.hour)}:${pad(p.minute)}`,
    minutes: p.hour * 60 + p.minute,
  };
}

/** Soma dias a uma data AAAA-MM-DD (sem fuso). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Dia da semana de uma data AAAA-MM-DD: 0 = domingo ... 6 = sábado. */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Segunda-feira da semana da data. */
export function startOfWeek(date: string): string {
  const weekday = weekdayOf(date);
  return addDays(date, weekday === 0 ? -6 : 1 - weekday);
}

/** "09:30" → 570 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number) as [number, number];
  return h * 60 + m;
}

/** 570 → "09:30" */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const longDate = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
const shortDay = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "short", day: "2-digit" });

/** "sexta-feira, 14 de novembro" */
export function formatLongDate(date: string): string {
  return longDate.format(new Date(`${date}T00:00:00Z`));
}

/** "sex., 14" */
export function formatShortDay(date: string): string {
  return shortDay.format(new Date(`${date}T00:00:00Z`));
}
