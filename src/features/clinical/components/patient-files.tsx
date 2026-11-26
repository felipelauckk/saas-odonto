"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Images, Loader2, Upload } from "lucide-react";
import { cn } from "cn";

import { EmptyState } from "@/components/feedback/empty-state";
import { FormMessage } from "@/components/forms/form-message";
import { SimpleSelect } from "@/components/forms/simple-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

import { prepareUpload, registerPatientFile } from "../actions";
import { ALLOWED_FILE_TYPES, MAX_FILE_BYTES, fileKindLabels, formatBytes, type FileKind } from "../files";

type FileRow = {
  id: string;
  kind: FileKind;
  description: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  url: string | null;
};

type Props = { patientId: string; files: FileRow[]; canWrite: boolean };

const kinds = Object.keys(fileKindLabels) as FileKind[];

function Uploader({ patientId }: { patientId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<File[]>([]);
  const [kind, setKind] = useState<FileKind>("xray");
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
      const { error: uploadError } = await supabase.storage
        .from("clinic")
        .upload(prepared.path, file, { contentType: file.type, upsert: false });
      if (uploadError) {
        failures.push(`${file.name}: não foi possível enviar.`);
        continue;
      }
      const registered = await registerPatientFile({
        patientId,
        path: prepared.path,
        kind,
        description,
        mimeType: file.type,
        size: file.size,
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

  return (
    <section className="space-y-4 rounded-xl border p-5 sm:p-6" aria-labelledby="enviar-arquivos">
      <h2 id="enviar-arquivos" className="text-base font-medium">
        Enviar arquivos
      </h2>
      {done ? <FormMessage state={{ status: "success", message: done }} /> : null}
      {errors.length ? <FormMessage state={{ status: "error", message: errors.join(" ") }} /> : null}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ALLOWED_FILE_TYPES.join(",")}
        className="sr-only"
        id="arquivos-paciente"
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
      {tooBig.length ? (
        <p className="text-sm text-destructive">Maiores que 20 MB: {tooBig.map((f) => f.name).join(", ")}</p>
      ) : null}
      {selected.length ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <SimpleSelect
            id="file-kind"
            label="Tipo"
            value={kind}
            onChange={(v) => setKind(v as FileKind)}
            options={kinds.map((k) => ({ value: k, label: fileKindLabels[k] }))}
          />
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="file-description">Descrição (opcional)</Label>
            <Input
              id="file-description"
              placeholder="Ex.: panorâmica inicial"
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

export function PatientFiles({ patientId, files, canWrite }: Props) {
  const [filter, setFilter] = useState<FileKind | "all">("all");
  const visible = filter === "all" ? files : files.filter((f) => f.kind === filter);
  const presentKinds = kinds.filter((k) => files.some((f) => f.kind === k));

  const chip = (active: boolean) =>
    cn(
      "inline-flex h-8 items-center rounded-full border px-3 text-sm transition-colors pointer-coarse:h-11",
      active ? "border-foreground bg-foreground font-semibold text-background" : "text-muted-foreground hover:bg-muted",
    );

  return (
    <div className="space-y-6">
      {canWrite ? <Uploader patientId={patientId} /> : null}

      {files.length ? (
        <>
          {presentKinds.length > 1 ? (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por tipo">
              <button type="button" className={chip(filter === "all")} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
                Todos
              </button>
              {presentKinds.map((k) => (
                <button key={k} type="button" className={chip(filter === k)} aria-pressed={filter === k} onClick={() => setFilter(k)}>
                  {fileKindLabels[k]}
                </button>
              ))}
            </div>
          ) : null}
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {visible.map((f) => {
              const isImage = f.mime_type?.startsWith("image/") && f.mime_type !== "image/heic";
              return (
                <li key={f.id}>
                  <a
                    href={f.url ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="group block overflow-hidden rounded-xl border outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <div className="flex aspect-square items-center justify-center overflow-hidden bg-muted/40">
                      {isImage && f.url ? (
                        // eslint-disable-next-line @next/next/no-img-element -- URL assinada temporária do Storage
                        <img src={f.url} alt={f.description ?? fileKindLabels[f.kind]} className="size-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
                      ) : (
                        <FileText className="size-10 text-muted-foreground" aria-hidden />
                      )}
                    </div>
                    <div className="space-y-0.5 p-2.5">
                      <p className="truncate text-sm font-medium">{f.description || fileKindLabels[f.kind]}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {fileKindLabels[f.kind]} · {formatDateTime(f.created_at)} {f.size_bytes ? `· ${formatBytes(f.size_bytes)}` : ""}
                      </p>
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted-foreground">Os links dos arquivos valem por 10 minutos. Recarregue a página para gerar novos.</p>
        </>
      ) : (
        <EmptyState icon={Images} title="Nenhum arquivo" description="Fotos, radiografias e documentos do paciente aparecem aqui." />
      )}
    </div>
  );
}
