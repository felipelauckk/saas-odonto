"use client";

import { useState, useTransition } from "react";
import { Pencil, Repeat2, Trash2 } from "lucide-react";

import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatLongDate, minutesToTime, utcToZoned } from "@/lib/timezone";

import { deleteCommitment } from "../actions";
import type { AgendaBlock } from "../queries";
import type { CommitmentScope } from "../schemas";

import { scopeLabels } from "./commitment-form";

type Props = {
  block: AgendaBlock;
  professionalName: string | null;
  /** Dentista não edita nem exclui compromisso da clínica toda. */
  canEdit: boolean;
  onEdit: () => void;
  onDone: (message?: string) => void;
};

/** Detalhes de um compromisso: quando, para quem, se bloqueia; editar e excluir (com escopo na série). */
export function CommitmentDetails({ block: b, professionalName, canEdit, onEdit, onDone }: Props) {
  const [askDelete, setAskDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const start = utcToZoned(b.startsAt);
  const end = utcToZoned(b.endsAt);
  const when = b.allDay ? "Dia inteiro" : `${start.time} às ${end.date === start.date ? end.time : minutesToTime(b.endMin === 1440 ? 1439 : b.endMin)}`;

  function remove(scope: CommitmentScope) {
    setError(null);
    startTransition(async () => {
      const result = await deleteCommitment(b.id, scope);
      if (result.error) setError(result.error);
      else onDone(result.deleted && result.deleted > 1 ? `${result.deleted} compromissos excluídos.` : "Compromisso excluído.");
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="type-title">{b.title}</DialogTitle>
        <DialogDescription>
          {formatLongDate(start.date)} · {when} · {professionalName ?? "Clínica toda"}
        </DialogDescription>
      </DialogHeader>
      <ul className="flex flex-wrap gap-1.5 text-xs font-semibold">
        <li className={b.kind === "block" ? "rounded-full bg-muted px-2.5 py-0.5 text-muted-foreground" : "rounded-full bg-tint-lilac px-2.5 py-0.5 text-tint-lilac-foreground"}>
          {b.kind === "block" ? "Bloqueia a agenda" : "Só lembrete (não bloqueia)"}
        </li>
        {b.seriesId ? (
          <li className="inline-flex items-center gap-1 rounded-full bg-tint-sky px-2.5 py-0.5 text-tint-sky-foreground">
            <Repeat2 className="size-3" aria-hidden />
            Se repete
          </li>
        ) : null}
      </ul>
      {b.notes ? <p className="text-sm whitespace-pre-line">{b.notes}</p> : null}
      {error ? <FormMessage state={{ status: "error", message: error }} /> : null}

      {askDelete && b.seriesId ? (
        <div role="alertdialog" aria-label="Excluir quais ocorrências" className="space-y-3 rounded-lg border border-destructive/30 bg-destructive-soft p-4">
          <p className="text-sm font-medium">Este compromisso se repete. Excluir:</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(scopeLabels) as CommitmentScope[]).map((s) => (
              <Button key={s} type="button" variant={s === "one" ? "destructive" : "outline"} disabled={pending} onClick={() => remove(s)}>
                {scopeLabels[s]}
              </Button>
            ))}
            <Button type="button" variant="ghost" onClick={() => setAskDelete(false)}>
              Voltar
            </Button>
          </div>
        </div>
      ) : null}

      <DialogFooter>
        <Button variant="outline" onClick={() => onDone()}>
          Fechar
        </Button>
        {canEdit ? (
          <>
            <Button variant="outline" onClick={onEdit}>
              <Pencil aria-hidden />
              Editar
            </Button>
            <Button variant="destructive" disabled={pending} onClick={() => (b.seriesId ? setAskDelete(true) : remove("one"))}>
              <Trash2 aria-hidden />
              Excluir
            </Button>
          </>
        ) : null}
      </DialogFooter>
    </>
  );
}
