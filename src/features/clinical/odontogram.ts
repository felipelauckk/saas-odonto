import type { Database } from "@/lib/supabase/database.types";

export type ToothCondition = Database["public"]["Enums"]["tooth_condition"];
export type Face = "M" | "D" | "O" | "V" | "L";

export const FACES: readonly Face[] = ["V", "M", "O", "D", "L"];

/** Arcadas na ordem de exibição (visão do dentista, de frente para o paciente). */
export const ARCHES = {
  upperPermanent: [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28],
  lowerPermanent: [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38],
  upperDeciduous: [55, 54, 53, 52, 51, 61, 62, 63, 64, 65],
  lowerDeciduous: [85, 84, 83, 82, 81, 71, 72, 73, 74, 75],
} as const;

export const conditions = [
  "caries",
  "restored",
  "root_canal",
  "crown",
  "implant",
  "missing",
  "other",
  "healthy",
] as const satisfies readonly ToothCondition[];

export const conditionLabels: Record<ToothCondition, string> = {
  healthy: "Hígido (limpar)",
  caries: "Cárie",
  restored: "Restaurado",
  missing: "Ausente",
  implant: "Implante",
  crown: "Coroa",
  root_canal: "Canal",
  other: "Outro",
};

/** Cores da legenda (fortes o bastante para ler sobre fundo claro e escuro). */
export const conditionColors: Record<ToothCondition, string> = {
  healthy: "transparent",
  caries: "#dc2626",
  restored: "#2563eb",
  missing: "#64748b",
  implant: "#7c3aed",
  crown: "#d97706",
  root_canal: "#db2777",
  other: "#0d9488",
};

/** Condições que valem para o dente inteiro (não por face). */
export const WHOLE_TOOTH: readonly ToothCondition[] = ["missing", "implant", "crown", "root_canal"];

export function faceLabel(face: Face, tooth: number): string {
  const upper = [1, 2, 5, 6].includes(Math.floor(tooth / 10));
  const anterior = tooth % 10 <= 3;
  switch (face) {
    case "M":
      return "Mesial";
    case "D":
      return "Distal";
    case "O":
      return anterior ? "Incisal" : "Oclusal";
    case "V":
      return "Vestibular";
    case "L":
      return upper ? "Palatina" : "Lingual";
  }
}

export type ToothState = { whole: ToothCondition | null; faces: Partial<Record<Face, ToothCondition>> };

type RecordLike = { tooth: number; faces: string[]; condition: ToothCondition };

/**
 * Estado atual do odontograma a partir dos registros em ordem cronológica.
 * Registro posterior sobrescreve o anterior; "hígido" limpa o dente (ou as faces).
 */
export function currentState(records: RecordLike[]): Map<number, ToothState> {
  const state = new Map<number, ToothState>();
  for (const r of records) {
    const tooth = state.get(r.tooth) ?? { whole: null, faces: {} };
    if (r.faces.length === 0) {
      if (r.condition === "healthy") {
        tooth.whole = null;
        tooth.faces = {};
      } else {
        tooth.whole = r.condition;
      }
    } else {
      for (const face of r.faces as Face[]) {
        if (r.condition === "healthy") delete tooth.faces[face];
        else tooth.faces[face] = r.condition;
      }
    }
    if (tooth.whole === null && Object.keys(tooth.faces).length === 0) state.delete(r.tooth);
    else state.set(r.tooth, tooth);
  }
  return state;
}
