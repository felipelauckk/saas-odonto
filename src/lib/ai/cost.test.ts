import { describe, expect, it } from "vitest";

import { addUsage, costUsd } from "./cost";

describe("custo da IA", () => {
  it("entrada, saída e cache pelo preço do modelo", () => {
    // 1M de entrada ($4) + 100 mil de saída ($2) + 1M lido do cache ($0,20) + 100 mil escritos no cache ($0,50)
    expect(costUsd("claude-opus-5-5", { input_tokens: 1_000_000, output_tokens: 100_000, cache_read_input_tokens: 1_000_000, cache_creation_input_tokens: 100_000 })).toBeCloseTo(6.7, 6);
    expect(costUsd("claude-opus-5-5", { input_tokens: 1200, output_tokens: 300 })).toBeCloseTo(0.0108, 6);
  });

  it("soma usos", () => {
    expect(addUsage({ input_tokens: 1, output_tokens: 2 }, { input_tokens: 3, output_tokens: 4, cache_read_input_tokens: 5 })).toEqual({ input_tokens: 4, output_tokens: 6, cache_read_input_tokens: 5, cache_creation_input_tokens: 0 });
  });
});
