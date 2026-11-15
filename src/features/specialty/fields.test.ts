import { describe, expect, it } from "vitest";

import { fieldsSchema, perioSummary, sanitizeData, slugify, type Field } from "./fields";

const fields: Field[] = [
  { id: "diagnosis", label: "Diagnóstico", type: "textarea" },
  { id: "class", label: "Classe", type: "select", options: ["I", "II"] },
  { id: "months", label: "Meses", type: "number" },
  { id: "graft", label: "Enxerto", type: "yes_no" },
  { id: "implants", label: "Implantes", type: "table", columns: [{ id: "tooth", label: "Dente" }, { id: "brand", label: "Marca" }] },
  { id: "chart", label: "Periograma", type: "perio" },
];

describe("fichas por especialidade", () => {
  it("limpa respostas conforme o modelo", () => {
    const data = sanitizeData(fields, {
      diagnosis: "  Apinhamento  ",
      class: "III",
      months: "18,5",
      graft: true,
      implants: [{ tooth: "36", brand: "Neodent", extra: "x" }, { tooth: "", brand: "" }],
      chart: { "16": { depth: [3, 5, 99, null, 2, 4], bleeding: [false, true, false, false, false, false] }, "99": { depth: [9], bleeding: [] } },
      unknown: "ignorado",
    });
    expect(data).toEqual({
      diagnosis: "Apinhamento",
      months: 18.5,
      graft: true,
      implants: [{ tooth: "36", brand: "Neodent" }],
      chart: { "16": { depth: [3, 5, 15, null, 2, 4], bleeding: [false, true, false, false, false, false] } },
    });
  });

  it("resumo do periograma e validação do modelo", () => {
    expect(perioSummary({ "16": { depth: [3, 5, 15, null, 2, 4], bleeding: [false, true, false, false, false, false] } })).toEqual({ sites: 5, pockets: 3, bleedingRate: 0.2 });
    expect(fieldsSchema.safeParse([{ id: "a", label: "A", type: "text" }, { id: "a", label: "B", type: "text" }]).success).toBe(false);
    expect(slugify("Comprimento (mm) da raiz")).toBe("comprimento_mm_da_raiz");
  });
});
