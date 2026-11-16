"use client";

import { forwardRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "cn";

import { StatusBadge } from "@/components/app/status-badge";
import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setItemDone } from "@/features/plans/actions";
import { formatDate } from "@/lib/format";

import { addToothRecord } from "../actions";
import {
  WHOLE_TOOTH,
  conditionColors,
  conditionLabels,
  conditions,
  faceLabel,
  toothName,
  type Face,
  type ToothCondition,
  type ToothState,
} from "../odontogram";
import { itemLabel, type PlanItem } from "./plan-checklist";

export type ToothRecord = {
  id: string;
  tooth: number;
  faces: string[];
  condition: ToothCondition;
  notes: string | null;
  recordedBy: string | null;
  created_at: string;
};

type Props = {
  patientId: string;
  tooth: number;
  faces: Face[];
  state: ToothState | undefined;
  history: ToothRecord[];
  planItems: PlanItem[];
  canWrite: boolean;
  canMarkDone: boolean;
  onClose: () => void;
  onSaved: () => void;
};

function facesText(faces: string[], tooth: number) {
  return faces.map((f) => faceLabel(f as Face, tooth)).join(", ");
}

/** Dente selecionado: estado atual, histórico só dele, registro e itens do plano. */
export const ToothPanel = forwardRef<HTMLElement, Props>(function ToothPanel(
  { patientId, tooth, faces, state, history, planItems, canWrite, canMarkDone, onClose, onSaved },
  ref,
) {
  const router = useRouter();
  const [condition, setCondition] = useState<ToothCondition>("caries");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<{
    status: "error" | "success";
    message: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const wholeOnly = WHOLE_TOOTH.includes(condition);

  const current = [
    ...(state?.whole
      ? [
          {
            key: "whole",
            condition: state.whole,
            text: conditionLabels[state.whole],
          },
        ]
      : []),
    ...Object.entries(state?.faces ?? {}).map(([face, c]) => ({
      key: face,
      condition: c,
      text: `${conditionLabels[c]} · ${faceLabel(face as Face, tooth).toLowerCase()}`,
    })),
  ];

  function save() {
    startTransition(async () => {
      const result = await addToothRecord({
        patientId,
        tooth,
        faces,
        condition,
        notes,
      });
      if (result.error) setMessage({ status: "error", message: result.error });
      else {
        setMessage({
          status: "success",
          message: `Dente ${tooth}: ${conditionLabels[condition]} registrado.`,
        });
        setNotes("");
        onSaved();
      }
    });
  }

  function markDone(item: PlanItem) {
    startTransition(async () => {
      const result = await setItemDone(item.id, true);
      if (result.error) setMessage({ status: "error", message: result.error });
      else {
        setMessage({
          status: "success",
          message: `${item.description} marcado como realizado.`,
        });
        router.refresh();
      }
    });
  }

  return (
    <section ref={ref} aria-labelledby="dente-selecionado" className="scroll-mt-4 space-y-4 rounded-card border-2 border-primary bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <h2 id="dente-selecionado" className="type-section">
          Dente {tooth} · {toothName(tooth)}
        </h2>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Fechar" onClick={onClose} className="-mt-1 -mr-1">
          <X aria-hidden />
        </Button>
      </div>

      {current.length || planItems.some((i) => i.status === "approved") ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Estado atual">
          {current.map((c) => (
            <li key={c.key}>
              <StatusBadge tone={c.condition === "caries" ? "danger" : "info"}>{c.text}</StatusBadge>
            </li>
          ))}
          {planItems
            .filter((i) => i.status === "approved")
            .map((i) => (
              <li key={i.id}>
                <StatusBadge tone="warning">{i.description} planejado</StatusBadge>
              </li>
            ))}
        </ul>
      ) : (
        <p className="text-[0.8125rem] text-muted-foreground">Sem registros neste dente.</p>
      )}

      {history.length ? (
        <ol className="space-y-1.5" aria-label={`Histórico do dente ${tooth}`}>
          {history.map((r) => (
            <li key={r.id} className="flex gap-2.5 text-[0.8125rem] leading-snug">
              <span className="shrink-0 text-muted-foreground tabular-nums">{formatDate(r.created_at).slice(0, 5)}</span>
              <span className="min-w-0">
                {conditionLabels[r.condition]}
                {r.faces.length ? ` · ${facesText(r.faces, tooth)}` : ""}
                {r.notes ? <span className="text-muted-foreground"> — {r.notes}</span> : null}
                {r.recordedBy ? <span className="text-muted-foreground"> · {r.recordedBy}</span> : null}
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      {message ? <FormMessage state={message} /> : null}

      {canMarkDone && planItems.some((i) => i.status === "approved") ? (
        <ul className="space-y-2 border-t border-border-soft pt-3" aria-label="Plano de tratamento deste dente">
          {planItems
            .filter((i) => i.status === "approved")
            .map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 text-[0.8125rem]">
                <span className="min-w-0">{itemLabel(i)}</span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={pending}
                  onClick={() => markDone(i)}
                  aria-label={`Marcar realizado: ${itemLabel(i)}`}
                >
                  Marcar realizado
                </Button>
              </li>
            ))}
        </ul>
      ) : null}

      {canWrite ? (
        <div className="space-y-3 border-t border-border-soft pt-3">
          <p className="text-[0.8125rem] text-muted-foreground">
            {wholeOnly || faces.length === 0 ? "Dente inteiro" : `Faces: ${facesText(faces, tooth)}`} · clique nas faces do desenho para escolher.
          </p>
          <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Condição">
            {conditions.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={condition === c}
                onClick={() => setCondition(c)}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-lg border px-2.5 text-[0.8125rem] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:h-11",
                  condition === c ? "border-primary bg-accent text-accent-foreground" : "hover:bg-muted",
                )}
              >
                <span className="size-3 shrink-0 rounded-sm border" style={{ backgroundColor: conditionColors[c] }} aria-hidden />
                {conditionLabels[c]}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tooth-notes">Observação (opcional)</Label>
            <Input id="tooth-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
          </div>
          <Button type="button" onClick={save} disabled={pending} className="w-full">
            {pending ? "Registrando..." : "Registrar"}
          </Button>
        </div>
      ) : null}
    </section>
  );
});
