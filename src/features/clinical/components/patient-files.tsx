"use client";

import { useState, useTransition } from "react";
import { ArrowDownUp, Columns2, Download, FileText, FolderInput, FolderPlus, Images, Trash2, X } from "lucide-react";
import { cn } from "cn";

import { EmptyState } from "@/components/feedback/empty-state";
import { FormMessage } from "@/components/forms/form-message";
import { SimpleSelect } from "@/components/forms/simple-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatDate, formatDateTime } from "@/lib/format";

import { createFileFolders, deleteFileFolder, moveFilesToFolder } from "../actions";
import { SUGGESTED_FOLDERS, fileKindLabels, formatBytes, type FileKind } from "../files";
import { FileUploader } from "./file-uploader";

export type FileRow = {
  id: string;
  kind: FileKind;
  description: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  folder_id: string | null;
  url: string | null;
  downloadUrl: string | null;
};

type Folder = { id: string; name: string };
type Props = { patientId: string; files: FileRow[]; folders: Folder[]; canWrite: boolean };

const isImage = (f: FileRow) => Boolean(f.mime_type?.startsWith("image/") && f.mime_type !== "image/heic");

const chip = (active: boolean) =>
  cn(
    "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors pointer-coarse:h-11",
    active ? "border-foreground bg-foreground font-semibold text-background" : "bg-card text-muted-foreground hover:bg-muted",
  );

/** Baixa vários arquivos (um link de download por arquivo, em sequência). */
function downloadAll(files: FileRow[]) {
  files.forEach((f, i) => {
    if (!f.downloadUrl) return;
    window.setTimeout(() => {
      const a = document.createElement("a");
      a.href = f.downloadUrl!;
      a.rel = "noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }, i * 400);
  });
}

/**
 * Fotos e arquivos do paciente em pastas: grade de miniaturas, ordem por data,
 * seleção múltipla para mover ou baixar e comparação de duas fotos lado a lado.
 */
export function PatientFiles({ patientId, files, folders, canWrite }: Props) {
  const [folder, setFolder] = useState<string>("all");
  const [kind, setKind] = useState<FileKind | "all">("all");
  const [newestFirst, setNewestFirst] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moveTo, setMoveTo] = useState("none");
  const [newFolder, setNewFolder] = useState<string | null>(null);
  const [compare, setCompare] = useState<[FileRow, FileRow] | null>(null);
  const [message, setMessage] = useState<{ status: "error" | "success"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const visible = files
    .filter((f) => (folder === "all" ? true : folder === "none" ? !f.folder_id : f.folder_id === folder))
    .filter((f) => kind === "all" || f.kind === kind)
    .sort((a, b) => (newestFirst ? b.created_at.localeCompare(a.created_at) : a.created_at.localeCompare(b.created_at)));
  const presentKinds = (["photo", "document", "other"] as FileKind[]).filter((k) => files.some((f) => f.kind === k));
  const chosen = files.filter((f) => selected.has(f.id));
  const currentFolder = folders.find((f) => f.id === folder) ?? null;

  /** Marca ou desmarca (idempotente: o mesmo evento repetido não desfaz). */
  function setChecked(id: string, on: boolean) {
    setSelected((prev) => {
      if (prev.has(id) === on) return prev;
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function run(fn: () => Promise<{ error?: string }>, success: string, after?: () => void) {
    setMessage(null);
    startTransition(async () => {
      const r = await fn();
      if (r.error) setMessage({ status: "error", message: r.error });
      else {
        setMessage({ status: "success", message: success });
        after?.();
      }
    });
  }

  return (
    <div className="space-y-6">
      {canWrite ? <FileUploader key={folder} patientId={patientId} mode="files" folders={folders} folderId={currentFolder?.id ?? null} /> : null}
      {message ? <FormMessage state={message} /> : null}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Pastas">
          <button type="button" className={chip(folder === "all")} aria-pressed={folder === "all"} onClick={() => setFolder("all")}>
            Todas
          </button>
          {folders.length ? (
            <button type="button" className={chip(folder === "none")} aria-pressed={folder === "none"} onClick={() => setFolder("none")}>
              Sem pasta
            </button>
          ) : null}
          {folders.map((f) => (
            <button key={f.id} type="button" className={chip(folder === f.id)} aria-pressed={folder === f.id} onClick={() => setFolder(f.id)}>
              {f.name}
              <span className="text-xs opacity-70">{files.filter((x) => x.folder_id === f.id).length}</span>
            </button>
          ))}
          {canWrite ? (
            newFolder === null ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setNewFolder("")}>
                <FolderPlus aria-hidden />
                Nova pasta
              </Button>
            ) : (
              <form
                className="flex items-center gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(() => createFileFolders({ patientId, names: [newFolder] }), "Pasta criada.", () => setNewFolder(null));
                }}
              >
                <Input aria-label="Nome da pasta" autoFocus maxLength={60} className="h-8 w-40" value={newFolder} onChange={(e) => setNewFolder(e.target.value)} />
                <Button type="submit" size="sm" disabled={pending || !newFolder.trim()}>
                  Criar
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Cancelar" onClick={() => setNewFolder(null)}>
                  <X aria-hidden />
                </Button>
              </form>
            )
          ) : null}
          {canWrite && !folders.length ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => run(() => createFileFolders({ patientId, names: [...SUGGESTED_FOLDERS] }), "Pastas Inicial, Durante e Final criadas.")}
            >
              Criar pastas sugeridas (Inicial, Durante, Final)
            </Button>
          ) : null}
          {canWrite && currentFolder ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => {
                if (window.confirm(`Apagar a pasta "${currentFolder.name}"? Os arquivos dela continuam guardados, sem pasta.`)) {
                  run(() => deleteFileFolder({ patientId, folderId: currentFolder.id }), "Pasta apagada.", () => setFolder("all"));
                }
              }}
            >
              <Trash2 aria-hidden />
              Apagar pasta
            </Button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por categoria">
            {presentKinds.length > 1 ? (
              <>
                <button type="button" className={chip(kind === "all")} aria-pressed={kind === "all"} onClick={() => setKind("all")}>
                  Todas as categorias
                </button>
                {presentKinds.map((k) => (
                  <button key={k} type="button" className={chip(kind === k)} aria-pressed={kind === k} onClick={() => setKind(k)}>
                    {fileKindLabels[k]}
                  </button>
                ))}
              </>
            ) : null}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => setNewestFirst((v) => !v)}>
            <ArrowDownUp aria-hidden />
            {newestFirst ? "Mais recentes primeiro" : "Mais antigos primeiro"}
          </Button>
        </div>
      </div>

      {selected.size ? (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-card border bg-card p-3 shadow-card" role="region" aria-label="Arquivos selecionados">
          <span className="text-sm font-semibold">
            {selected.size} {selected.size === 1 ? "selecionado" : "selecionados"}
          </span>
          {canWrite ? (
            <div className="flex items-center gap-2">
              <SimpleSelect
                id="mover-para"
                aria-label="Mover para a pasta"
                className="h-10 w-40 pointer-coarse:h-11"
                value={moveTo}
                onChange={setMoveTo}
                options={[{ value: "none", label: "Sem pasta" }, ...folders.map((f) => ({ value: f.id, label: f.name }))]}
              />
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  run(
                    () => moveFilesToFolder({ patientId, fileIds: [...selected], folderId: moveTo === "none" ? null : moveTo }),
                    "Arquivos movidos.",
                    () => setSelected(new Set()),
                  )
                }
              >
                <FolderInput aria-hidden />
                Mover
              </Button>
            </div>
          ) : null}
          <Button type="button" variant="outline" onClick={() => downloadAll(chosen)}>
            <Download aria-hidden />
            Baixar
          </Button>
          {chosen.length === 2 && chosen.every(isImage) ? (
            <Button type="button" onClick={() => setCompare([chosen[0]!, chosen[1]!].sort((a, b) => a.created_at.localeCompare(b.created_at)) as [FileRow, FileRow])}>
              <Columns2 aria-hidden />
              Comparar
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">Selecione duas fotos para comparar.</span>
          )}
          <Button type="button" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>
            Limpar seleção
          </Button>
        </div>
      ) : null}

      {visible.length ? (
        <>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" aria-label="Arquivos">
            {visible.map((f) => {
              const checked = selected.has(f.id);
              return (
                <li key={f.id} className={cn("relative overflow-hidden rounded-xl border bg-card", checked && "ring-2 ring-primary")}>
                  <div className="absolute top-2 left-2 z-10 flex size-8 items-center justify-center rounded-lg bg-card/90 shadow-sm pointer-coarse:size-11">
                    <Checkbox aria-label={`Selecionar ${f.description || fileKindLabels[f.kind]}`} checked={checked} onCheckedChange={(v) => setChecked(f.id, v === true)} />
                  </div>
                  <a href={f.url ?? undefined} target="_blank" rel="noreferrer" className="group block outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                    <div className="flex aspect-square items-center justify-center overflow-hidden bg-muted/40">
                      {isImage(f) && f.url ? (
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
      ) : files.length ? (
        <p className="rounded-card border bg-card px-5 py-8 text-center text-sm text-muted-foreground">Nenhum arquivo nesta pasta.</p>
      ) : (
        <EmptyState icon={Images} title="Nenhum arquivo" description="Fotos e documentos do paciente aparecem aqui. Exames ficam na aba Exames." />
      )}

      <Dialog open={compare !== null} onOpenChange={(o) => !o && setCompare(null)}>
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Antes e depois</DialogTitle>
            <DialogDescription>A foto mais antiga fica à esquerda.</DialogDescription>
          </DialogHeader>
          {compare ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {compare.map((f, i) => (
                <figure key={f.id} className="space-y-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada temporária do Storage */}
                  <img src={f.url ?? undefined} alt={f.description ?? "Foto"} className="max-h-[70vh] w-full rounded-xl border bg-muted/40 object-contain" />
                  <figcaption className="text-sm">
                    <span className="font-semibold">{i === 0 ? "Antes" : "Depois"}</span>
                    <span className="text-muted-foreground"> · {formatDate(f.created_at)}{f.description ? ` · ${f.description}` : ""}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
