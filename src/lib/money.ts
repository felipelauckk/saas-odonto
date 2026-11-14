/**
 * Converte texto digitado em reais para centavos (inteiro).
 * Aceita "1.234,56", "1234,56", "1234.56", "R$ 1.234,56", "150" e "150,5".
 * Devolve null se não for um valor válido e não negativo.
 */
export function parseBRLToCents(input: string): number | null {
  const cleaned = input.replace(/R\$/gi, "").replace(/\s/g, "");
  if (!cleaned) return null;
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+([.,]\d{1,2})?$/.test(cleaned)) return null;

  let normalized: string;
  if (cleaned.includes(",")) {
    // Formato brasileiro: ponto é milhar, vírgula é decimal.
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    // "1.234" sem vírgula: ponto como milhar.
    normalized = cleaned.replace(/\./g, "");
  } else {
    normalized = cleaned;
  }

  const [whole = "0", fraction = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

/** Centavos para o texto de um campo de valor, ex.: 123456 → "1.234,56". */
export function centsToInput(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    cents / 100,
  );
}

/** "2,5" ou "2.5" → 2.5. Null se inválido. */
export function parseDecimal(input: string): number | null {
  const cleaned = input.replace(/%/g, "").replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Number(cleaned);
}
