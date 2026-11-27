"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";

import { FormMessage } from "@/components/forms/form-message";
import { SimpleSelect } from "@/components/forms/simple-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { todayIso } from "@/lib/dates";
import { createClient } from "@/lib/supabase/client";

import { prepareUpload, registerPatientFile } from "../actions";
import { ALLOWED_FILE_TYPES, EXAM_TYPES, MAX_FILE_BYTES, examTypeLabels, fileKindLabels, type ExamType, type FileKind } from "../files";

type Props = {
  patientId: string;
  /** "exams": categoria Exame, com tipo e data; "files": as outras categorias. */
  mode: "files" | "exams";
  folders?: { id: string; name: string }[];
  /** Pasta aberta na tela (os arquivos entram nela). */
  folderId?: string | null;
};

const FILE_KINDS: FileKind[] = ["photo", "document", "other"];

export function FileUploader({ patientId, mode, folders = [], folderId = null }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<File[]>([]);
  const [kind, setKind] = useState<FileKind>(mode === "exams" ? "xray" : "photo");
  const [examType, setExamType] = useState<ExamType>("panoramica");
  const [takenOn, setTakenOn] = useState(() => todayIso());
  const [folder, setFolder] = useState<string>(folderId ?? "none");
  const [description, setDescription] = useState("");
  const [progress, setProgress] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState<string | null>(null);

  async function upload() {
    setErrors([]);
    setDone(null);
    const supabase = createClient();
    const failures: string[] = [];
    let sent = 0;

    for (const [index, file] of selected.entries()) {
      setProgress(`Enviando ${index + 1} de ${selected.length}: ${file.name}`);
      const prepared = await prepareUpload({ patientId, fileName: file.name, mimeType: file.type, size: file.size });
      if (prepared.error || !prepared.path) {
        failures.push(`${file.name}: ${prepared.error}`);
        continue;
      }
      // Direto do navegador para o Storage: não passa pelo servidor (limite de tamanho da Vercel).
      const { error: uploadError } = await supabase.storage.from("clinic").upload(prepared.path, file, { contentType: file.type, upsert: false });
      if (uploadError) {
        failures.push(`${file.name}: não foi possível enviar.`);
        continue;
      }
      const registered = await registerPatientFile({
        patientId,
        path: prepared.path,
        kind: mode === "exams" ? "xray" : kind,
        description,
        mimeType: file.type,
        size: file.size,
        folderId: mode === "files" && folder !== "none" ? folder : null,
        examType: mode === "exams" ? examType : null,
        takenOn: mode === "exams" && takenOn ? takenOn : null,
      });
      if (registered.error) failures.push(`${file.name}: ${registered.error}`);
      else sent++;
    }

    setProgress(null);
    setErrors(failures);
    if (sent) {
      setDone(sent === 1 ? "Arquivo enviado." : `${sent} arquivos enviados.`);
      setSelected([]);
      setDescription("");
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    }
  }

  const tooBig = selected.filter((f) => f.size > MAX_FILE_BYTES);
  const id = `upload-${mode}`;

  return (
    <section className="space-y-4 rounded-card border bg-card p-5 shadow-card sm:p-6" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="type-section">
        {mode === "exams" ? "Enviar exames" : "Enviar fotos e arquivos"}
      </h2>
      {done ? <FormMessage state={{ status: "success", message: done }} /> : null}
      {errors.length ? <FormMessage state={{ status: "error", message: errors.join(" ") }} /> : null}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ALLOWED_FILE_TYPES.join(",")}
        className="sr-only"
        id={id}
        onChange={(e) => {
          setSelected(Array.from(e.target.files ?? []));
          setDone(null);
          setErrors([]);
        }}
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={progress !== null}>
          <Upload aria-hidden />
          {selected.length ? "Trocar seleção" : "Escolher arquivos"}
        </Button>
        <span className="text-sm text-muted-foreground">
          {selected.length
            ? `${selected.length} ${selected.length === 1 ? "arquivo selecionado" : "arquivos selecionados"}`
            : "Imagens (JPG, PNG, WebP, HEIC) ou PDF, até 20 MB cada."}
        </span>
      </div>
      {tooBig.length ? <p className="text-sm text-destructive">Maiores que 20 MB: {tooBig.map((f) => f.name).join(", ")}</p> : null}
      {selected.length ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {mode === "exams" ? (
            <>
              <SimpleSelect
                id={`${id}-exam-type`}
                label="Tipo de exame"
                value={examType}
                onChange={(v) => setExamType(v as ExamType)}
                options={EXAM_TYPES.map((k) => ({ value: k, label: examTypeLabels[k] }))}
              />
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-taken-on`}>Data do exame</Label>
                <Input id={`${id}-taken-on`} type="date" value={takenOn} max={todayIso()} onChange={(e) => setTakenOn(e.target.value)} />
              </div>
            </>
          ) : (
            <>
              <SimpleSelect
                id={`${id}-kind`}
                label="Categoria"
                value={kind}
                onChange={(v) => setKind(v as FileKind)}
                options={FILE_KINDS.map((k) => ({ value: k, label: fileKindLabels[k] }))}
              />
              <SimpleSelect
                id={`${id}-folder`}
                label="Pasta"
                value={folder}
                onChange={setFolder}
                options={[{ value: "none", label: "Sem pasta" }, ...folders.map((f) => ({ value: f.id, label: f.name }))]}
              />
            </>
          )}
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-description`}>Descrição (opcional)</Label>
            <Input
              id={`${id}-description`}
              placeholder={mode === "exams" ? "Ex.: panorâmica inicial" : "Ex.: sorriso frontal"}
              value={description}
              maxLength={300}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
      ) : null}
      {selected.length ? (
        <Button type="button" onClick={upload} disabled={progress !== null || tooBig.length > 0}>
          {progress ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {progress ?? "Enviar"}
        </Button>
      ) : null}
    </section>
  );
}
