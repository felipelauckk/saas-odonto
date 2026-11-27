import type { Database } from "@/lib/supabase/database.types";

export type FileKind = Database["public"]["Enums"]["patient_file_kind"];

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const ALLOWED_FILE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

export const fileKindLabels: Record<FileKind, string> = {
  photo: "Foto",
  xray: "Exame",
  document: "Documento",
  other: "Outro",
};

export function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

/** Tipos de exame (arquivos da categoria "Exame"). */
export const EXAM_TYPES = ["panoramica", "periapical", "interproximal", "tomografia", "outro"] as const;
export type ExamType = (typeof EXAM_TYPES)[number];

export const examTypeLabels: Record<ExamType, string> = {
  panoramica: "Radiografia panorâmica",
  periapical: "Radiografia periapical",
  interproximal: "Radiografia interproximal",
  tomografia: "Tomografia",
  outro: "Outro exame",
};

/** Pastas sugeridas para fotos de tratamento. */
export const SUGGESTED_FOLDERS = ["Inicial", "Durante", "Final"] as const;
