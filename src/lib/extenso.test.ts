import { describe, expect, it } from "vitest";

import { centsToWords } from "./extenso";

describe("centsToWords", () => {
  it.each([
    [100, "um real"],
    [20000, "duzentos reais"],
    [10000, "cem reais"],
    [10100, "cento e um reais"],
    [125050, "mil duzentos e cinquenta reais e cinquenta centavos"],
    [110000, "mil e cem reais"],
    [102000, "mil e vinte reais"],
    [1500001, "quinze mil reais e um centavo"],
    [100000000, "um milhão de reais"],
    [99, "noventa e nove centavos"],
    [1714, "dezessete reais e quatorze centavos"],
  ])("%i → %s", (cents, words) => {
    expect(centsToWords(cents)).toBe(words);
  });
});
