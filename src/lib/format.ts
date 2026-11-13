export const APP_TIME_ZONE = "America/Sao_Paulo";
export const APP_LOCALE = "pt-BR";

const currencyFormatter = new Intl.NumberFormat(APP_LOCALE, {
  style: "currency",
  currency: "BRL",
});

const dateFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Formata um valor em centavos (inteiro, como fica no banco) em reais. */
export function formatCurrency(cents: number): string {
  if (!Number.isSafeInteger(cents)) {
    throw new TypeError(`Valor em centavos deve ser inteiro: ${cents}`);
  }
  return currencyFormatter.format(cents / 100);
}

/** Data no fuso de São Paulo, ex.: 13/11/2026. */
export function formatDate(value: Date | string): string {
  return dateFormatter.format(toDate(value));
}

/** Data e hora no fuso de São Paulo, ex.: 13/11/2026, 14:30. */
export function formatDateTime(value: Date | string): string {
  return dateTimeFormatter.format(toDate(value));
}

function toDate(value: Date | string): Date {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Data inválida: ${String(value)}`);
  }
  return date;
}
