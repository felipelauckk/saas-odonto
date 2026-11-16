/**
 * Mapa único de status → tom de cor. Cor só onde há urgência: vermelho e âmbar
 * indicam algo parado, vencido ou esperando; verde, concluído com sucesso.
 * O texto do status vem dos rótulos de cada módulo; aqui só a cor.
 */
import type { Database } from "@/lib/supabase/database.types";

type Enums = Database["public"]["Enums"];

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

export const appointmentTones: Record<Enums["appointment_status"], StatusTone> = {
  scheduled: "warning",
  confirmed: "success",
  arrived: "info",
  in_progress: "info",
  done: "neutral",
  no_show: "danger",
  canceled: "neutral",
};

export const receivableTones: Record<Enums["receivable_status"], StatusTone> = {
  open: "warning",
  overdue: "danger",
  paid: "success",
  canceled: "neutral",
};

export const payableTones: Record<Enums["payable_status"], StatusTone> = receivableTones;

export const chargeTones: Record<Enums["charge_status"], StatusTone> = {
  pending: "warning",
  overdue: "danger",
  paid: "success",
  canceled: "neutral",
  refunded: "neutral",
};

export const planTones: Record<Enums["treatment_plan_status"], StatusTone> = {
  draft: "neutral",
  presented: "warning",
  approved: "success",
  partially_approved: "success",
  rejected: "danger",
  completed: "neutral",
};

export const planItemTones: Record<Enums["treatment_item_status"], StatusTone> = {
  pending: "warning",
  approved: "info",
  rejected: "neutral",
  done: "success",
};

export const invoiceTones: Record<Enums["invoice_status"], StatusTone> = {
  processing: "warning",
  authorized: "success",
  canceled: "neutral",
  error: "danger",
};

export const documentTones: Record<Enums["document_status"], StatusTone> = {
  issued: "warning",
  signed: "success",
  canceled: "neutral",
};
