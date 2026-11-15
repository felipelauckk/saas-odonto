"use client";

import { useState, useTransition } from "react";
import { FileText, MessageSquarePlus } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { FormMessage } from "@/components/forms/form-message";
import { SimpleSelect } from "@/components/forms/simple-select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";

import { VoiceDictation } from "@/features/ai/components/voice-dictation";

import { addClinicalNote } from "../actions";

type Note = {
  id: string;
  body: string;
  created_at: string;
  complements_note_id: string | null;
  professionals: { name: string; color: string } | null;
};

type Props = {
  patientId: string;
  notes: Note[];
  canWrite: boolean;
  professionals: { id: string; name: string }[];
};

function NoteForm({
  patientId,
  professionals,
  complementsNoteId,
  onDone,
  onCancel,
}: {
  patientId: string;
  professionals: { id: string; name: string }[];
  complementsNoteId?: string;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [professionalId, setProfessionalId] = useState(professionals[0]?.id ?? "");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fieldId = complementsNoteId ? `complemento-${complementsNoteId}` : "nova-evolucao";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await addClinicalNote({ patientId, professionalId, body, complementsNoteId: complementsNoteId ?? null });
      if (result.error) setError(result.error);
      else {
        setBody("");
        onDone();
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      {error ? <FormMessage state={{ status: "error", message: error }} /> : null}
      {professionals.length > 1 ? (
        <SimpleSelect
          id={`${fieldId}-prof`}
          label="Profissional"
          value={professionalId}
          onChange={setProfessionalId}
          options={professionals.map((p) => ({ value: p.id, label: p.name }))}
        />
      ) : null}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={fieldId}>{complementsNoteId ? "Complemento" : "Nova evolução"}</Label>
          <VoiceDictation kind="note" title="Ditar evolução" onResult={(r) => setBody((b) => (b.trim() ? `${b.trim()}\n${r.data.text}` : r.data.text))} />
        </div>
        <Textarea
          id={fieldId}
          rows={complementsNoteId ? 3 : 5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={complementsNoteId ? "O que precisa ser acrescentado?" : "Procedimento realizado, materiais, orientações..."}
        />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" disabled={pending || body.trim().length < 3}>
          {pending ? "Salvando..." : complementsNoteId ? "Salvar complemento" : "Registrar evolução"}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Depois de salva, a evolução não pode ser editada nem apagada, só complementada.
      </p>
    </form>
  );
}

function NoteCard({ note, complements, canComplement, onComplement }: { note: Note; complements: Note[]; canComplement: boolean; onComplement: () => void }) {
  return (
    <article className="space-y-3 px-4 py-4 sm:px-5">
      <header className="flex flex-wrap items-center gap-x-2 text-sm">
        <span className="size-2.5 rounded-full" style={{ backgroundColor: note.professionals?.color ?? "#64748b" }} aria-hidden />
        <span className="font-medium">{note.professionals?.name ?? "Profissional"}</span>
        <span className="text-muted-foreground">{formatDateTime(note.created_at)}</span>
      </header>
      <p className="whitespace-pre-line text-sm leading-relaxed">{note.body}</p>
      {complements.map((c) => (
        <div key={c.id} className="space-y-1 border-l-2 pl-3">
          <p className="text-xs text-muted-foreground">
            Complemento · {c.professionals?.name} · {formatDateTime(c.created_at)}
          </p>
          <p className="whitespace-pre-line text-sm leading-relaxed">{c.body}</p>
        </div>
      ))}
      {canComplement ? (
        <Button type="button" variant="ghost" size="sm" onClick={onComplement}>
          <MessageSquarePlus aria-hidden />
          Complementar
        </Button>
      ) : null}
    </article>
  );
}

export function ClinicalNotes({ patientId, notes, canWrite, professionals }: Props) {
  const [complementing, setComplementing] = useState<string | null>(null);
  const writer = canWrite && professionals.length > 0;
  const originals = notes.filter((n) => !n.complements_note_id).reverse();
  const complementsOf = (id: string) => notes.filter((n) => n.complements_note_id === id);

  return (
    <div className="space-y-6">
      {writer ? (
        <section className="rounded-xl border p-5 sm:p-6" aria-label="Nova evolução">
          <NoteForm patientId={patientId} professionals={professionals} onDone={() => undefined} />
        </section>
      ) : canWrite ? (
        <p className="text-sm text-muted-foreground">Para registrar evoluções, seu usuário precisa estar ligado a um profissional.</p>
      ) : null}

      {originals.length ? (
        <div className="divide-y rounded-xl border">
          {originals.map((note) =>
            complementing === note.id ? (
              <div key={note.id}>
                <NoteCard note={note} complements={complementsOf(note.id)} canComplement={false} onComplement={() => undefined} />
                <div className="px-4 pb-4 sm:px-5">
                  <NoteForm
                    patientId={patientId}
                    professionals={professionals}
                    complementsNoteId={note.id}
                    onDone={() => setComplementing(null)}
                    onCancel={() => setComplementing(null)}
                  />
                </div>
              </div>
            ) : (
              <NoteCard
                key={note.id}
                note={note}
                complements={complementsOf(note.id)}
                canComplement={writer}
                onComplement={() => setComplementing(note.id)}
              />
            ),
          )}
        </div>
      ) : (
        <EmptyState icon={FileText} title="Nenhuma evolução registrada" description="As evoluções clínicas aparecem aqui, da mais recente para a mais antiga." />
      )}
    </div>
  );
}
