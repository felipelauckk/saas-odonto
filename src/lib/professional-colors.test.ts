import { describe, expect, it } from "vitest";

import { PROFESSIONAL_COLORS, professionalColor } from "./professional-colors";

describe("professionalColor", () => {
  it("cor da paleta volta ela mesma, sem diferenciar maiúsculas", () => {
    for (const c of PROFESSIONAL_COLORS) expect(professionalColor(c.value.toLowerCase())).toBe(c);
  });

  it("cores antigas vão para a mais próxima da paleta", () => {
    expect(professionalColor("#0e7490").label).toBe("Petróleo");
    expect(professionalColor("#7c3aed").label).toBe("Violeta");
    expect(professionalColor("#16a34a").label).toBe("Verde");
    expect(professionalColor("#db2777").label).toBe("Rosa");
    expect(professionalColor("#2563eb").label).toBe("Azul");
    expect(professionalColor("#ea580c").label).toBe("Âmbar");
  });

  it("valor inválido usa a primeira cor", () => {
    expect(professionalColor(null)).toBe(PROFESSIONAL_COLORS[0]);
    expect(professionalColor("azul")).toBe(PROFESSIONAL_COLORS[0]);
  });
});
