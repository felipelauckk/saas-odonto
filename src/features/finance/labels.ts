import type { Database } from "@/lib/supabase/database.types";

export type ReceivableStatus = Database["public"]["Enums"]["receivable_status"];

export const receivableStatusLabels: Record<ReceivableStatus, string> = {
  open: "Em aberto",
  overdue: "Vencido",
  paid: "Pago",
  canceled: "Cancelado",
};

export const RECEIVABLE_FILTERS = {
  pendentes: { label: "A receber", statuses: ["open", "overdue"] },
  vencidos: { label: "Vencidos", statuses: ["overdue"] },
  pagos: { label: "Pagos", statuses: ["paid"] },
  cancelados: { label: "Cancelados", statuses: ["canceled"] },
  todos: { label: "Todos", statuses: ["open", "overdue", "paid", "canceled"] },
} as const satisfies Record<string, { label: string; statuses: readonly ReceivableStatus[] }>;

export type ReceivableFilter = keyof typeof RECEIVABLE_FILTERS;
