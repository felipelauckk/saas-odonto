import { addDays } from "@/lib/timezone";

import type { ProstheticKind, ProstheticStage } from "./labels";

export type OrderTiming = {
  kind: ProstheticKind;
  stage: ProstheticStage;
  expectedReturnOn: string | null;
  alignerTotal: number | null;
  alignerChangeDays: number | null;
  alignersDelivered: number;
  alignerStartedOn: string | null;
};

/** No laboratório e passou do retorno previsto. */
export function isLabLate(o: OrderTiming, today: string): boolean {
  return o.stage === "sent" && Boolean(o.expectedReturnOn) && o.expectedReturnOn! < today;
}

/** Ainda não voltou do laboratório: não marcar o paciente antes do retorno previsto. */
export function waitingLab(o: OrderTiming): boolean {
  return (o.stage === "impression" || o.stage === "sent") && Boolean(o.expectedReturnOn);
}

/**
 * Alinhadores: até quando duram as placas entregues e se é hora de entregar
 * as próximas (aviso 14 dias antes de acabarem).
 */
export function alignerStatus(o: OrderTiming, today: string, warnDays = 14) {
  if (o.kind !== "aligner" || !o.alignerTotal || !o.alignerChangeDays || !o.alignerStartedOn) return null;
  const runsOutOn = addDays(o.alignerStartedOn, o.alignersDelivered * o.alignerChangeDays);
  const finished = o.alignersDelivered >= o.alignerTotal;
  const currentAligner = Math.min(o.alignerTotal, Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${o.alignerStartedOn}T00:00:00Z`)) / (o.alignerChangeDays * 86_400_000)) + 1);
  return {
    runsOutOn,
    finished,
    currentAligner: Math.max(1, currentAligner),
    needsDelivery: !finished && runsOutOn <= addDays(today, warnDays),
    endsOn: addDays(o.alignerStartedOn, o.alignerTotal * o.alignerChangeDays),
  };
}
