"use client";

import { useState, useTransition } from "react";
import { Check, Copy, MessageCircle, Send } from "lucide-react";

import { FormMessage } from "@/components/forms/form-message";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createSigningLink } from "../actions";
import { DEFAULT_SIGNATURE_DAYS } from "../labels";

type Props = { patientId: string; documentId: string | null; label: string; triggerLabel: string };

/** Gera o link de assinatura e oferece copiar ou abrir no WhatsApp da clínica. */
export function SendLinkDialog({ patientId, documentId, label, triggerLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(String(DEFAULT_SIGNATURE_DAYS));
  const [result, setResult] = useState<{ url: string; whatsappText: string; phone: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function generate() {
    const n = Number(days);
    if (!Number.isInteger(n) || n < 1 || n > 60) return setError("Prazo entre 1 e 60 dias.");
    setError(null);
    startTransition(async () => {
      const r = await createSigningLink({ patientId, documentId, days: n });
      if (r.error || !r.url) setError(r.error ?? "Não foi possível gerar o link.");
      else setResult({ url: r.url, whatsappText: r.whatsappText!, phone: r.phone ?? null });
    });
  }

  const waHref = result ? `https://wa.me/${result.phone ? `55${result.phone}` : ""}?text=${encodeURIComponent(result.whatsappText)}` : "#";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setResult(null);
          setError(null);
          setCopied(false);
        }
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Send aria-hidden />
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{documentId ? "Enviar para assinatura" : "Enviar anamnese por link"}</DialogTitle>
          <DialogDescription>
            {documentId ? `O paciente lê e assina "${label}" pelo celular.` : "O paciente preenche e assina a anamnese pelo celular antes da consulta."} O link é
            pessoal, de uso único e expira.
          </DialogDescription>
        </DialogHeader>
        {error ? <FormMessage state={{ status: "error", message: error }} /> : null}
        {result ? (
          <div className="space-y-3">
            <Input readOnly value={result.url} aria-label="Link de assinatura" onFocus={(e) => e.currentTarget.select()} />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  await navigator.clipboard.writeText(result.url);
                  setCopied(true);
                }}
              >
                {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                {copied ? "Copiado" : "Copiar link"}
              </Button>
              <a href={waHref} target="_blank" rel="noreferrer" className={buttonVariants()}>
                <MessageCircle aria-hidden />
                Abrir no WhatsApp
              </a>
            </div>
            <p className="text-xs text-muted-foreground">Gerar um novo link cancela o anterior deste documento.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="link-days">Prazo do link (dias)</Label>
              <Input id="link-days" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} className="w-28" />
            </div>
            <Button onClick={generate} disabled={pending}>
              {pending ? "Gerando..." : "Gerar link"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
