"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

import { patientPhotoUrl, setPatientPhoto } from "../actions";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Foto do paciente: vai direto do navegador para o bucket privado; a ficha guarda o caminho. */
export function PatientPhotoField({ patientId, clinicId, initialPath, name }: { patientId: string; clinicId: string; initialPath: string | null; name: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    if (initialPath) patientPhotoUrl(initialPath).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [initialPath]);

  function upload(file: File) {
    setError(null);
    const ext = TYPES[file.type];
    if (!ext) return setError("Use uma foto JPG, PNG ou WebP.");
    if (file.size > MAX_BYTES) return setError("A foto pode ter no máximo 5 MB.");
    startTransition(async () => {
      const path = `${clinicId}/patient-photos/${patientId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await createClient().storage.from("clinic").upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) return setError("Não foi possível enviar a foto.");
      const r = await setPatientPhoto(patientId, path);
      if (r.error) setError(r.error);
      else setUrl(r.url ?? null);
    });
  }

  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

  return (
    <div className="flex items-center gap-4">
      <span className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-accent text-xl font-extrabold text-accent-foreground">
        {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada e temporária do Storage */}
        {url ? <img src={url} alt={`Foto de ${name}`} className="size-full object-cover" /> : <span aria-hidden>{initials}</span>}
      </span>
      <div className="space-y-2">
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-label="Escolher foto do paciente"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => input.current?.click()}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Camera aria-hidden />}
            {url ? "Trocar foto" : "Incluir foto"}
          </Button>
          {url ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await setPatientPhoto(patientId, null);
                  if (r.error) setError(r.error);
                  else setUrl(null);
                })
              }
            >
              <Trash2 aria-hidden />
              Tirar foto
            </Button>
          ) : null}
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : <p className="text-xs text-muted-foreground">JPG, PNG ou WebP, até 5 MB.</p>}
      </div>
    </div>
  );
}
