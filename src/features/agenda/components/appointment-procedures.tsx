"use client";

import { useState } from "react";
import { ClipboardList, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProcedureCatalog } from "@/features/plans/components/procedure-catalog";

import type { PlanItemOption } from "../actions";
import type { AgendaData } from "../queries";

export type FormProcedure = {
  key: string;
  /** null = item do plano escrito à mão (sem procedimento cadastrado). */
  procedureId: string | null;
  name: string;
  /** 0 = sem duração cadastrada (não entra na soma). */
  durationMin: number;
  treatmentItemId: string | null;
  tooth: number | null;
  faces: string[] | null;
};

let counter = 0;
export const procedureKey = () => `p${++counter}`;

export function durationLabel(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

const toothText = (p: { tooth: number | null; faces: string[] | null }) => (p.tooth ? `Dente ${p.tooth}${p.faces?.length ? ` · ${p.faces.join("")}` : ""}` : null);

type Props = {
  value: FormProcedure[];
  onChange: (next: FormProcedure[]) => void;
  catalog: AgendaData["procedures"];
  /** Itens do plano aprovado ainda não feitos nem agendados. */
  planItems: PlanItemOption[];
};

/** Lista de procedimentos da consulta, com "Do plano de tratamento" primeiro e o catálogo com busca. */
export function AppointmentProcedures({ value, onChange, catalog, planItems }: Props) {
  const [adding, setAdding] = useState(false);
  const usedItems = new Set(value.map((p) => p.treatmentItemId).filter(Boolean));
  const fromPlan = planItems.filter((i) => !usedItems.has(i.id));

  const add = (p: Omit<FormProcedure, "key">) => {
    onChange([...value, { ...p, key: procedureKey() }]);
    setAdding(false);
  };

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium" id="appt-procedures">
        Procedimentos
      </span>
      {value.length ? (
        <ul aria-labelledby="appt-procedures" className="divide-y rounded-lg border">
          {value.map((p) => (
            <li key={p.key} className="flex items-center gap-3 px-3 py-2">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{p.name}</span>
                <span className="text-xs text-muted-foreground">
                  {[toothText(p), p.durationMin ? durationLabel(p.durationMin) : null, p.treatmentItemId ? "do plano de tratamento" : null].filter(Boolean).join(" · ")}
                </span>
              </span>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Tirar ${p.name}`} onClick={() => onChange(value.filter((x) => x.key !== p.key))}>
                <X />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[0.8125rem] text-muted-foreground">Nenhum procedimento. Opcional: a soma das durações sugere a duração da consulta.</p>
      )}

      {adding ? (
        <div className="space-y-4 rounded-lg border bg-muted/30 p-3">
          {fromPlan.length ? (
            <section aria-labelledby="from-plan" className="space-y-1.5">
              <h3 id="from-plan" className="flex items-center gap-2 text-[0.8125rem] font-semibold">
                <span className="flex size-6 items-center justify-center rounded-md bg-tint-mint text-tint-mint-foreground">
                  <ClipboardList className="size-3.5" aria-hidden />
                </span>
                Do plano de tratamento
              </h3>
              <ul className="-mx-1">
                {fromPlan.map((i) => (
                  <li key={i.id}>
                    <button
                      type="button"
                      aria-label={`Incluir do plano: ${i.name}${i.tooth ? `, dente ${i.tooth}` : ""}`}
                      onClick={() => add({ procedureId: i.procedureId, name: i.name, durationMin: i.durationMin, treatmentItemId: i.id, tooth: i.tooth, faces: i.faces.length ? i.faces : null })}
                      className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left outline-none transition-colors hover:bg-card focus-visible:ring-3 focus-visible:ring-ring/40"
                    >
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[0.8125rem] font-medium">{i.name}</span>
                        <span className="text-xs text-muted-foreground">{toothText(i) ?? "Sem dente"}</span>
                      </span>
                      <span className="text-[0.8125rem] text-muted-foreground tabular-nums">{i.durationMin ? durationLabel(i.durationMin) : "sem duração"}</span>
                      <Plus className="size-4 shrink-0 text-primary" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <section aria-label="Catálogo de procedimentos" className="space-y-1.5">
            {fromPlan.length ? <h3 className="text-[0.8125rem] font-semibold">Catálogo</h3> : null}
            <ProcedureCatalog
              procedures={catalog}
              autoFocus={!fromPlan.length}
              listClassName="max-h-56"
              meta={(p) => durationLabel(p.duration_min)}
              onPick={(p) => add({ procedureId: p.id, name: p.name, durationMin: p.duration_min, treatmentItemId: null, tooth: null, faces: null })}
            />
          </section>
          <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
            Fechar catálogo
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)} disabled={!catalog.length && !fromPlan.length}>
          <Plus aria-hidden />
          Adicionar procedimento
        </Button>
      )}
    </div>
  );
}
