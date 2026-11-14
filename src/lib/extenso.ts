const UNITS = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
const TEENS = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const TENS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const HUNDREDS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

/** 0–999 por extenso. */
function upTo999(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h) parts.push(HUNDREDS[h]!);
  if (rest >= 10 && rest < 20) parts.push(TEENS[rest - 10]!);
  else {
    const t = Math.floor(rest / 10);
    const u = rest % 10;
    if (t) parts.push(TENS[t]!);
    if (u) parts.push(UNITS[u]!);
  }
  return parts.join(" e ");
}

function integerToWords(n: number): string {
  if (n === 0) return "zero";
  const groups = [
    { value: Math.floor(n / 1_000_000) % 1000, one: "um milhão", many: "milhões" },
    { value: Math.floor(n / 1000) % 1000, one: "mil", many: "mil" },
    { value: n % 1000, one: "", many: "" },
  ];
  const words: { text: string; value: number }[] = [];
  for (const g of groups) {
    if (!g.value) continue;
    if (g.one === "mil") words.push({ text: g.value === 1 ? "mil" : `${upTo999(g.value)} mil`, value: g.value });
    else if (g.one) words.push({ text: g.value === 1 ? g.one : `${upTo999(g.value)} ${g.many}`, value: g.value });
    else words.push({ text: upTo999(g.value), value: g.value });
  }
  // "e" antes do último grupo quando ele é menor que 100 ou centena redonda (ex.: mil e cem, mil e vinte).
  return words
    .map((w, i) => {
      if (i === 0) return w.text;
      const last = i === words.length - 1;
      return last && (w.value < 100 || w.value % 100 === 0) ? `e ${w.text}` : w.text;
    })
    .join(" ");
}

/** Valor em centavos por extenso, ex.: 125050 → "mil duzentos e cinquenta reais e cinquenta centavos". */
export function centsToWords(cents: number): string {
  const reais = Math.floor(cents / 100);
  const centavos = cents % 100;
  const parts: string[] = [];
  if (reais) {
    const millionsExact = reais >= 1_000_000 && reais % 1_000_000 === 0;
    parts.push(`${integerToWords(reais)}${millionsExact ? " de" : ""} ${reais === 1 ? "real" : "reais"}`);
  }
  if (centavos) parts.push(`${integerToWords(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);
  return parts.length ? parts.join(" e ") : "zero real";
}
