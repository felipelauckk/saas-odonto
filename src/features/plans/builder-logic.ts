import type { Face, ToothCondition } from "@/features/clinical/odontogram";

type SuggestionLike = { tooth: number; faces: Face[]; condition: ToothCondition };

/**
 * Achados do odontograma (cárie, ausência...) que o orçamento ainda não cobre:
 * some o aviso quando algum item já é para aquele dente.
 */
export function uncoveredSuggestions<S extends SuggestionLike>(suggestions: S[], items: { tooth: number | null }[]): S[] {
  const covered = new Set(items.map((i) => i.tooth).filter((t): t is number => t !== null));
  return suggestions.filter((s) => !covered.has(s.tooth));
}
