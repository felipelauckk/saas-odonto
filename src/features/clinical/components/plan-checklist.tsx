import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "cn";

import { StatusBadge } from "@/components/app/status-badge";
import { formatCurrency } from "@/lib/format";
import { utcToZoned } from "@/lib/timezone";

import { faceLabel, type Face } from "../odontogram";

export type PlanItem = {
  id: string;
  description: string;
  tooth: number | null;
  faces: string[];
  status: "pending" | "approved" | "rejected" | "done";
  priceCents: number;
  sessionsPlanned?: number;
  sessionsDone?: number;
};

/** "2 de 3 sessões" quando o procedimento leva mais de uma sessão. */
export function sessionsLabel(item: Pick<PlanItem, "sessionsPlanned" | "sessionsDone">): string | null {
  const planned = item.sessionsPlanned ?? 1;
  if (planned <= 1) return null;
  return `${Math.min(item.sessionsDone ?? 0, planned)} de ${planned} sessões`;
}

export type PatientPlan = {
  id: string;
  status: "approved" | "partially_approved" | "completed";
  approvedAt: string | null;
  totalCents: number;
  items: PlanItem[];
};

const STATUS = {
  approved: "Aprovado",
  partially_approved: "Aprovado em parte",
  completed: "Concluído",
} as const;

export function itemLabel(item: Pick<PlanItem, "description" | "tooth" | "faces">) {
  if (item.tooth === null) return item.description;
  const faces = item.faces.length ? ` (${item.faces.map((f) => faceLabel(f as Face, item.tooth!)).join(", ")})` : "";
  return `${item.description} — ${item.tooth}${faces}`;
}

/** Andamento do plano aprovado: o que já foi feito e o que falta. */
export function PlanChecklist({ plan }: { plan: PatientPlan }) {
  const items = plan.items.filter((i) => i.status === "approved" || i.status === "done");
  const done = items.filter((i) => i.status === "done").length;
  const day = plan.approvedAt ? utcToZoned(plan.approvedAt).date.split("-").reverse().slice(0, 2).join("/") : null;

  return (
    <section aria-labelledby="plano-tratamento" className="space-y-3 rounded-card border bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <h2 id="plano-tratamento" className="type-section">
          Plano de tratamento
        </h2>
        <StatusBadge tone="success">
          {STATUS[plan.status]}
          {day ? ` ${day}` : ""}
        </StatusBadge>
      </div>
      <div className="flex items-center gap-2.5">
        <progress
          value={done}
          max={Math.max(items.length, 1)}
          aria-label="Itens realizados"
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-track [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-track [&::-webkit-progress-value]:bg-primary"
        />
        <span className="text-xs text-muted-foreground tabular-nums">
          {done} de {items.length}
        </span>
      </div>
      <ul>
        {items.map((item) => {
          const isDone = item.status === "done";
          return (
            <li key={item.id} className="grid min-h-9 grid-cols-[1.125rem_minmax(0,1fr)_auto] items-center gap-2 text-[0.8125rem]">
              <span
                aria-hidden
                className={cn(
                  "flex size-4 items-center justify-center rounded-[0.3rem] border-[1.5px]",
                  isDone ? "border-primary bg-primary text-primary-foreground" : "border-tooth-outline bg-card",
                )}
              >
                {isDone ? <Check className="size-2.5" strokeWidth={4} /> : null}
              </span>
              <span className={cn(isDone && "text-muted-foreground")}>
                {itemLabel(item)}
                {sessionsLabel(item) ? <span className="block text-xs text-muted-foreground">{sessionsLabel(item)}</span> : null}
                <span className="sr-only">{isDone ? ", realizado" : ", a fazer"}</span>
              </span>
              <span className="text-muted-foreground tabular-nums">{formatCurrency(item.priceCents)}</span>
            </li>
          );
        })}
      </ul>
      <div className="flex items-baseline justify-between gap-2 border-t border-border-soft pt-3 text-sm">
        <Link href={`/orcamentos/${plan.id}`} className="font-medium text-primary hover:text-primary-hover pointer-coarse:min-h-11 pointer-coarse:py-3">
          Abrir orçamento
        </Link>
        <span>
          <span className="text-muted-foreground">Total </span>
          <strong className="tabular-nums">{formatCurrency(plan.totalCents)}</strong>
        </span>
      </div>
    </section>
  );
}
