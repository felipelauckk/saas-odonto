"use client";

import { useState, useTransition } from "react";
import { FileText, Pencil, ScanLine } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { FormMessage } from "@/components/forms/form-message";
import { SimpleSelect } from "@/components/forms/simple-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatIsoDate } from "@/lib/dates";
import { formatDate } from "@/lib/format";

import { updateExam } from "../actions";
import { EXAM_TYPES, examTypeLabels, type ExamType } from "../files";
import { FileUploader } from "./file-uploader";

export type ExamRow = {
  id: string;
  description: string | null;
  mime_type: string | null;
  created_at: string;
  exam_type: string | null;
  taken_on: string | null;
  url: string | null;
};

const label = (t: string | null) => (t && t in examTypeLabels ? examTypeLabels[t as ExamType] : "Exame");

function EditExam({ patientId, exam, onClose }: { patientId: string; exam: ExamRow; onClose: () => void }) {
  const [type, setType] = useState<string>(exam.exam_type ?? "outro");
  const [takenOn, setTakenOn] = useState(exam.taken_on ?? "");
  const [description, setDescription] = useState(exam.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await updateExam({ patientId, fileId: exam.id, examType: type as ExamType, takenOn: takenOn || null, description });
          if (r.error) setError(r.error);
          else onClose();
        });
      }}
    >
      <DialogHeader>
        <DialogTitle>Dados do exame</DialogTitle>
        <DialogDescription>Tipo, data em que foi feito e descrição.</DialogDescription>
      </DialogHeader>
      {error ? <FormMessage state={{ status: "error", message: error }} /> : null}
      <SimpleSelect id="exame-tipo" label="Tipo de exame" value={type} onChange={setType} options={EXAM_TYPES.map((k) => ({ value: k, label: examTypeLabels[k] }))} />
      <div className="space-y-1.5">
        <Label htmlFor="exame-data">Data do exame</Label>
        <Input id="exame-data" type="date" value={takenOn} onChange={(e) => setTakenOn(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="exame-descricao">Descrição</Label>
        <Input id="exame-descricao" maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Aba Exames: radiografias e tomografias, com tipo e data do exame. */
export function PatientExams({ patientId, exams, canWrite }: { patientId: string; exams: ExamRow[]; canWrite: boolean }) {
  const [editing, setEditing] = useState<ExamRow | null>(null);
  const sorted = [...exams].sort((a, b) => (b.taken_on ?? b.created_at).localeCompare(a.taken_on ?? a.created_at));
  return (
    <div className="space-y-6">
      {canWrite ? <FileUploader patientId={patientId} mode="exams" /> : null}
      {sorted.length ? (
        <div className="overflow-hidden rounded-card border bg-card shadow-card">
          <ul className="divide-y" aria-label="Exames">
            {sorted.map((e) => {
              const img = e.mime_type?.startsWith("image/") && e.mime_type !== "image/heic";
              return (
                <li key={e.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <a href={e.url ?? undefined} target="_blank" rel="noreferrer" className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
                    {img && e.url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- URL assinada temporária do Storage
                      <img src={e.url} alt="" className="size-full object-cover" loading="lazy" />
                    ) : (
                      <FileText className="size-6 text-muted-foreground" aria-hidden />
                    )}
                  </a>
                  <div className="min-w-0 flex-1">
                    <a href={e.url ?? undefined} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium hover:underline">
                      {label(e.exam_type)}
                    </a>
                    <p className="truncate text-xs text-muted-foreground">
                      {e.taken_on ? `Feito em ${formatIsoDate(e.taken_on)}` : `Enviado em ${formatDate(e.created_at)}`}
                      {e.description ? ` · ${e.description}` : ""}
                    </p>
                  </div>
                  {canWrite ? (
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Editar ${label(e.exam_type)}`} onClick={() => setEditing(e)}>
                      <Pencil aria-hidden />
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <EmptyState icon={ScanLine} title="Nenhum exame" description="Radiografias e tomografias do paciente aparecem aqui, com o tipo e a data do exame." />
      )}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">{editing ? <EditExam patientId={patientId} exam={editing} onClose={() => setEditing(null)} /> : null}</DialogContent>
      </Dialog>
    </div>
  );
}
