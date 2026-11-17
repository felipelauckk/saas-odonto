import { describe, expect, it } from "vitest";

import { uncoveredSuggestions } from "./builder-logic";

describe("avisos do odontograma no orçamento", () => {
  it("mostra só o que ainda não tem item para o dente", () => {
    const suggestions = [
      { tooth: 24, faces: ["D" as const], condition: "caries" as const },
      { tooth: 36, faces: ["O" as const], condition: "caries" as const },
      { tooth: 18, faces: [], condition: "missing" as const },
    ];
    const r = uncoveredSuggestions(suggestions, [{ tooth: 36 }, { tooth: null }]);
    expect(r.map((s) => s.tooth)).toEqual([24, 18]);
  });
});
