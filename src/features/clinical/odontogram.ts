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

/** Cores da legenda: tokens do tema (globals.css), fortes o bastante para ler sobre o fundo. */
export const conditionColors: Record<ToothCondition, string> = {
  healthy: "transparent",
  caries: "var(--tooth-caries)",
  restored: "var(--tooth-restored)",
  missing: "var(--tooth-missing)",
  implant: "var(--tooth-implant)",
  crown: "var(--tooth-crown)",
  root_canal: "var(--tooth-canal)",
  other: "var(--tooth-other)",
};

/** Preenchimento da silhueta quando a condição vale para o dente inteiro. */
export const wholeFills: Partial<Record<ToothCondition, string>> = {
  crown: "var(--tooth-crown-soft)",
  implant: "var(--tooth-implant-soft)",
  root_canal: "var(--tooth-canal-soft)",
};

export const PLANNED_COLOR = "var(--tooth-planned)";

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

export type ToothKind = "incisor" | "canine" | "premolar" | "molar";

/** Tipo do dente pela numeração FDI (decíduos: 4 e 5 são molares). */
export function toothKind(tooth: number): ToothKind {
  const quadrant = Math.floor(tooth / 10);
  const unit = tooth % 10;
  if (unit <= 2) return "incisor";
  if (unit === 3) return "canine";
  if (quadrant >= 5) return "molar";
  return unit <= 5 ? "premolar" : "molar";
}

export function isUpperTooth(tooth: number) {
  return [1, 2, 5, 6].includes(Math.floor(tooth / 10));
}

const ORDINAL = ["", "1º", "2º", "3º"];

/** "1º molar inferior", "incisivo central superior", "canino decíduo inferior". */
export function toothName(tooth: number): string {
  const quadrant = Math.floor(tooth / 10);
  const unit = tooth % 10;
  const deciduous = quadrant >= 5;
  const arch = isUpperTooth(tooth) ? "superior" : "inferior";
  const kind = toothKind(tooth);
  let name: string;
  if (kind === "incisor") name = unit === 1 ? "incisivo central" : "incisivo lateral";
  else if (kind === "canine") name = "canino";
  else if (deciduous) name = `${ORDINAL[unit - 3]} molar`;
  else if (kind === "premolar") name = `${ORDINAL[unit - 3]} pré-molar`;
  else name = `${ORDINAL[unit - 5]} molar`;
  return `${name}${deciduous ? " decíduo" : ""} ${arch}`;
}

type PlanItemLike = { tooth: number | null; faces: string[]; status: string };

/**
 * Faces com tratamento aprovado e ainda não feito ("planejado"), por dente.
 * Só valem onde a face não tem outra condição registrada.
 */
export function plannedFaces(items: PlanItemLike[], state: Map<number, ToothState>): Map<number, Face[]> {
  const out = new Map<number, Face[]>();
  for (const item of items) {
    if (item.status !== "approved" || item.tooth === null) continue;
    const current = state.get(item.tooth);
    if (current?.whole === "missing") continue;
    const faces = (item.faces as Face[]).filter((f) => FACES.includes(f) && !current?.faces[f]);
    if (!faces.length) continue;
    out.set(item.tooth, [...new Set([...(out.get(item.tooth) ?? []), ...faces])]);
  }
  return out;
}
