import { todayIso } from "@/lib/dates";
import { addDays, utcToZoned, weekdayOf } from "@/lib/timezone";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function dayMonth(date: string, today: string) {
  const [y, m, d] = date.split("-");
  return `${d}/${m}${y === today.slice(0, 4) ? "" : `/${y}`}`;
}

/** Próxima consulta: "Hoje · 10:00", "Amanhã · 10:00" ou "Seg, 16/11 · 10:00". */
export function nextVisitLabel(startsAt: string, now: Date = new Date()): string {
  const today = todayIso(now);
  const { date, time } = utcToZoned(startsAt);
  if (date === today) return `Hoje · ${time}`;
  if (date === addDays(today, 1)) return `Amanhã · ${time}`;
  return `${WEEKDAYS[weekdayOf(date)]}, ${dayMonth(date, today)} · ${time}`;
}

/** Última visita: "02/11 · Avaliação" (com o ano se não for o atual). */
export function lastVisitLabel(startsAt: string, type: string | null, now: Date = new Date()): string {
  const day = dayMonth(utcToZoned(startsAt).date, todayIso(now));
  return type ? `${day} · ${type}` : day;
}

/** "mar/2024" a partir do cadastro. */
export function patientSince(createdAt: string): string {
  const [y, m] = utcToZoned(createdAt).date.split("-");
  return `${MONTHS[Number(m) - 1]}/${y}`;
}
