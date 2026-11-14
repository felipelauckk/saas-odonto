import type { Database } from "@/lib/supabase/database.types";

export type PlanStatus = Database["public"]["Enums"]["treatment_plan_status"];
export type ItemStatus = Database["public"]["Enums"]["treatment_item_status"];

export const planStatusLabels: Record<PlanStatus, string> = {
  draft: "Rascunho",
  presented: "Apresentado",
  approved: "Aprovado",
  partially_approved: "Aprovado em parte",
  rejected: "Recusado",
  completed: "Concluído",
};

export const itemStatusLabels: Record<ItemStatus, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Recusado",
  done: "Realizado",
};

export const OPEN_STATUSES: readonly PlanStatus[] = ["draft", "presented"];
export const planStatuses = ["draft", "presented", "approved", "partially_approved", "rejected", "completed"] as const satisfies readonly PlanStatus[];
