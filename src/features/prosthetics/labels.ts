import type { Database } from "@/lib/supabase/database.types";

export type ProstheticStage = Database["public"]["Enums"]["prosthetic_stage"];
export type ProstheticKind = Database["public"]["Enums"]["prosthetic_kind"];

/** Colunas do quadro (cancelada fica fora). */
export const boardStages: readonly ProstheticStage[] = ["impression", "sent", "try_in", "adjustment", "ready", "delivered"];

export const stageLabels: Record<ProstheticStage, string> = {
  impression: "Moldagem",
  sent: "No laboratório",
  try_in: "Prova",
  adjustment: "Ajuste",
  ready: "Pronto para entregar",
  delivered: "Entregue / cimentado",
  canceled: "Cancelada",
};

export const kindLabels: Record<ProstheticKind, string> = { prosthesis: "Prótese", aligner: "Alinhadores" };
