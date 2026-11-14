/**
 * Aceita só caminhos internos (ex.: "/agenda"). Qualquer outra coisa
 * (URL absoluta, "//site", vazio) vira o caminho padrão. Evita open redirect.
 */
export function safeRedirectPath(value: unknown, fallback = "/painel"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
