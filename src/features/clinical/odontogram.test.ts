import { describe, expect, it } from "vitest";

import { ARCHES, currentState, faceLabel } from "./odontogram";

describe("arcadas", () => {
  it("tem 32 permanentes e 20 decíduos, sem repetir", () => {
    const permanent = [...ARCHES.upperPermanent, ...ARCHES.lowerPermanent];
    const deciduous = [...ARCHES.upperDeciduous, ...ARCHES.lowerDeciduous];
    expect(new Set(permanent).size).toBe(32);
    expect(new Set(deciduous).size).toBe(20);
  });
});

describe("currentState", () => {
  it("marca faces e o registro mais novo vence", () => {
    const state = currentState([
      { tooth: 16, faces: ["O", "M"], condition: "caries" },
      { tooth: 16, faces: ["O"], condition: "restored" },
    ]);
    expect(state.get(16)).toEqual({ whole: null, faces: { O: "restored", M: "caries" } });
  });

  it("condição do dente inteiro convive com faces", () => {
    const state = currentState([
      { tooth: 11, faces: [], condition: "crown" },
      { tooth: 11, faces: ["V"], condition: "caries" },
    ]);
    expect(state.get(11)).toEqual({ whole: "crown", faces: { V: "caries" } });
  });

  it("hígido limpa o dente ou a face", () => {
    const state = currentState([
      { tooth: 26, faces: ["O", "D"], condition: "caries" },
      { tooth: 26, faces: ["O"], condition: "healthy" },
      { tooth: 36, faces: [], condition: "missing" },
      { tooth: 36, faces: [], condition: "healthy" },
    ]);
    expect(state.get(26)).toEqual({ whole: null, faces: { D: "caries" } });
    expect(state.has(36)).toBe(false);
  });
});

describe("faceLabel", () => {
  it("usa incisal nos anteriores e palatina na arcada superior", () => {
    expect(faceLabel("O", 11)).toBe("Incisal");
    expect(faceLabel("O", 16)).toBe("Oclusal");
    expect(faceLabel("L", 16)).toBe("Palatina");
    expect(faceLabel("L", 46)).toBe("Lingual");
    expect(faceLabel("L", 54)).toBe("Palatina");
  });
});
