/**
 * Custo de uma chamada à API do Claude em dólares, pelos preços por milhão de
 * tokens do modelo. Escrita em cache custa 1,25× a entrada (TTL de 5 min);
 * leitura do cache tem preço próprio.
 */
export type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

export const PRICES: Record<string, { input: number; output: number; cacheRead: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
};

export function costUsd(model: string, usage: Usage): number {
  const p = PRICES[model] ?? PRICES["claude-opus-5-5"]!;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const total = (usage.input_tokens * p.input + cacheWrite * p.input * 1.25 + cacheRead * p.cacheRead + usage.output_tokens * p.output) / 1_000_000;
  return Math.round(total * 1_000_000) / 1_000_000;
}

/** Soma o uso de várias chamadas (ex.: o laço de ferramentas do assistente). */
export function addUsage(a: Usage, b: Usage): Usage {
  return {
    input_tokens: a.input_tokens + b.input_tokens,
    output_tokens: a.output_tokens + b.output_tokens,
    cache_read_input_tokens: (a.cache_read_input_tokens ?? 0) + (b.cache_read_input_tokens ?? 0),
    cache_creation_input_tokens: (a.cache_creation_input_tokens ?? 0) + (b.cache_creation_input_tokens ?? 0),
  };
}
