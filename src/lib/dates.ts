import { APP_TIME_ZONE } from "./format";

const isoDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Data de hoje em São Paulo, no formato do banco (AAAA-MM-DD). */
export function todayIso(now: Date = new Date()): string {
  return isoDateFormatter.format(now);
}

/** Idade em anos completos numa data (AAAA-MM-DD), por padrão hoje em São Paulo. */
export function ageFromBirthDate(birthDate: string, today: string = todayIso()): number {
  const [by, bm, bd] = birthDate.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = today.split("-").map(Number) as [number, number, number];
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age--;
  return age;
}

/** "1990-05-03" → "03/05/1990" (sem conversão de fuso: é uma data, não um instante). */
export function formatIsoDate(value: string): string {
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}
