"use client";

import { useState, useTransition } from "react";
import { Pin, PinOff, Plus, StickyNote, Trash2 } from "lucide-react";

import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";

import { addPatientNote, deletePatientNote, setPatientNotePinned } from "../notes-actions";
import type { PatientNote } from "../queries";

type Props = { patientId: string; notes: PatientNote[]; userId: string; canManage: boolean };

/**
 * Notas gerais (recados da equipe, não prontuário). Nota não se edita: fixa,
 * desafixa ou apaga (quem escreveu ou a gestão).
 */
export function PatientNotes({ patientId, notes, userId, canManage }: Props) {
  const [adding, setAdding] = useState(false);
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const r = await addPatientNote({ patientId, body, pinned });
      if (r.error) return setError(r.error);
      setBody("");
      setPinned(false);
      setAdding(false);
    });
  }

  function run(fn: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (r.error) setError(r.error);
    });
  }

  return (
    <section aria-labelledby="notas-gerais" className="space-y-3 rounded-card border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <h2 id="notas-gerais" className="type-section flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-tint-peach text-tint-peach-foreground" aria-hidden>
            <StickyNote className="size-4" />
          </span>
          Notas
        </h2>
        {adding ? null : (
          <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus aria-hidden />
            Nota
          </Button>
        )}
      </div>
      {error ? <FormMessage state={{ status: "error", message: error }} /> : null}
      {adding ? (
        <div className="space-y-2 rounded-xl border p-3">
          <Label htmlFor="nova-nota" className="sr-only">
            Nova nota
          </Label>
          <Textarea id="nova-nota" autoFocus maxLength={2000} rows={3} placeholder="Ex.: prefere horários depois das 17h" value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={pinned} onCheckedChange={(v) => setPinned(Boolean(v))} />
              Fixar no topo
            </label>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
                Cancelar
              </Button>
              <Button type="button" size="sm" disabled={pending || !body.trim()} onClick={save}>
                {pending ? "Salvando..." : "Salvar nota"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {notes.length ? (
        <ul className="space-y-2" aria-label="Notas do paciente">
          {notes.map((n) => {
            const mine = n.created_by === userId || canManage;
            return (
              <li key={n.id} className="space-y-1 rounded-xl border px-3 py-2.5">
                <p className="whitespace-pre-wrap text-sm">{n.body}</p>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    {n.pinned ? <span className="font-semibold text-foreground">Fixada · </span> : null}
                    {n.author_name ?? "Alguém da equipe"} · {formatDateTime(n.created_at)}
                  </p>
                  {mine ? (
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={n.pinned ? "Desafixar nota" : "Fixar nota"}
                        title={n.pinned ? "Desafixar" : "Fixar"}
                        disabled={pending}
                        onClick={() => run(() => setPatientNotePinned(n.id, patientId, !n.pinned))}
                      >
                        {n.pinned ? <PinOff aria-hidden /> : <Pin aria-hidden />}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Apagar nota"
                        title="Apagar"
                        disabled={pending}
                        onClick={() => {
                          if (window.confirm("Apagar esta nota?")) run(() => deletePatientNote(n.id, patientId));
                        }}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : adding ? null : (
        <p className="text-sm text-muted-foreground">Nenhuma nota. Use para recados da equipe sobre o paciente (não é prontuário).</p>
      )}
    </section>
  );
}
