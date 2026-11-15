"use client";

import { useRef, useState, useTransition } from "react";
import { Upload } from "lucide-react";

import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";

import { importOfx, reconcile } from "../actions";

export function OfxImport() {
  const ref = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ status: "error" | "success"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-2">
      {message ? <FormMessage state={message} /> : null}
      <input
        ref={ref}
        type="file"
        accept=".ofx,.OFX,application/x-ofx"
        className="sr-only"
        id="ofx-file"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          // OFX dos bancos brasileiros costuma vir em Latin-1.
          const buffer = await file.arrayBuffer();
          let text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
          if (text.includes("�")) text = new TextDecoder("windows-1252").decode(buffer);
          startTransition(async () => {
            const r = await importOfx(text);
            setMessage(r.error ? { status: "error", message: r.error } : { status: "success", message: r.message ?? "Importado." });
            if (ref.current) ref.current.value = "";
          });
        }}
      />
      <Button variant="outline" disabled={pending} onClick={() => ref.current?.click()}>
        <Upload aria-hidden />
        {pending ? "Importando..." : "Importar extrato OFX"}
      </Button>
    </div>
  );
}

export function ReconcileActions({ bankId, suggestion }: { bankId: string; suggestion: { id: string; kind: "receivable" | "payable"; label: string } | null }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (kind: "receivable" | "payable" | "ignore", targetId?: string) =>
    startTransition(async () => {
      const r = await reconcile({ bankId, kind, targetId });
      setError(r.error ?? null);
    });
  return (
    <div className="flex flex-wrap items-center gap-2">
      {suggestion ? (
        <Button size="sm" disabled={pending} onClick={() => run(suggestion.kind, suggestion.id)}>
          Conciliar com: {suggestion.label}
        </Button>
      ) : (
        <span className="text-xs text-muted-foreground">Sem par sugerido</span>
      )}
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => run("ignore")}>
        Ignorar
      </Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
