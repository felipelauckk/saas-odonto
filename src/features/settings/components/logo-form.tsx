"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { ImageIcon, Upload } from "lucide-react";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { idleState } from "@/lib/action-state";

import { removeLogo, uploadLogo } from "../actions/clinic";

export function LogoForm({ logoUrl }: { logoUrl: string | null }) {
  const [state, action] = useActionState(uploadLogo, idleState);
  const [fileName, setFileName] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removing, startRemove] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-4">
      <FormMessage state={state} />
      {removeError ? <FormMessage state={{ status: "error", message: removeError }} /> : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted/40">
          {logoUrl ? (
            <Image src={logoUrl} alt="Logo da clínica" width={96} height={96} className="size-full object-contain" unoptimized />
          ) : (
            <ImageIcon className="size-6 text-muted-foreground" aria-hidden />
          )}
        </div>
        <form action={action} className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center" noValidate>
          <input
            ref={inputRef}
            type="file"
            name="logo"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            id="logo"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />
          <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
            <Upload aria-hidden />
            {fileName ? "Trocar arquivo" : "Escolher imagem"}
          </Button>
          {fileName ? (
            <>
              <span className="truncate text-sm text-muted-foreground sm:max-w-48">{fileName}</span>
              <SubmitButton pendingLabel="Enviando...">Enviar</SubmitButton>
            </>
          ) : logoUrl ? (
            <Button
              type="button"
              variant="ghost"
              disabled={removing}
              onClick={() =>
                startRemove(async () => {
                  const result = await removeLogo();
                  setRemoveError(result.error ?? null);
                })
              }
            >
              Remover logo
            </Button>
          ) : null}
        </form>
      </div>
      <p className="text-[0.8125rem] text-muted-foreground">PNG, JPG ou WebP, até 1 MB.</p>
    </div>
  );
}
