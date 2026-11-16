/**
 * Nome e símbolo do produto num só lugar. "Arcada" é provisório: verificar
 * registro no INPI e domínio antes do lançamento.
 */
export const BRAND = {
  name: "Arcada",
  tagline: "A clínica inteira em um lugar: agenda, prontuário, vendas e financeiro.",
} as const;

/** Desenho do símbolo em caixa 48×48: quadrado arredondado, arco e ponto. */
export const BRAND_MARK = {
  viewBox: "0 0 48 48",
  radius: 13,
  arc: "M13 33 C13 18.5, 35 18.5, 35 33",
  arcWidth: 4.2,
  dot: { cx: 24, cy: 33.2, r: 2.6 },
} as const;
