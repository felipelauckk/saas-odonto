import type { Database } from "@/lib/supabase/database.types";

export type FileKind = Database["public"]["Enums"]["patient_file_kind"];

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const ALLOWED_FILE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

export const fileKindLabels: Record<FileKind, string> = {
  photo: "Foto",
  xray: "Radiografia",
  document: "Documento",
  other: "Outro",
};

export function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}
