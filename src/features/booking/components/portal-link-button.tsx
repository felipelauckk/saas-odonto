"use client";

import { useState, useTransition } from "react";
import { Copy, ExternalLink, MessageCircle, UserRound } from "lucide-react";

import { FormMessage } from "@/components/forms/form-message";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { createPortalLink, revokePortalLinks } from "../actions";

/** Gera o link do portal do paciente e abre o WhatsApp com a mensagem pronta. */
export function PortalLinkButton({ patientId }: { patientId: string }) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<{ url: string; whatsapp: string | null } | null>(null);
  const [message, setMessage] = useState<{ status: "error" | "success"; message: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setOpen(true);
          setLink(null);
          setMessage(null);
          startTransition(async () => {
            const r = await createPortalLink(patientId);
            if (r.error || !r.url) setMessage({ status: "error", message: r.error ?? "Não foi possível gerar o link." });
            else setLink({ url: r.url, whatsapp: r.whatsapp ?? null });
          });
        }}
      >
        <UserRound aria-hidden />
        Portal do paciente
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Portal do paciente</DialogTitle>
            <DialogDescription>O paciente vê consultas, orçamentos, pagamentos e documentos, sem senha. O link vale por 30 dias.</DialogDescription>
          </DialogHeader>
          {message ? <FormMessage state={message} /> : null}
          {pending && !link ? <p className="text-sm text-muted-foreground" role="status">Gerando link...</p> : null}
          {link ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input readOnly value={link.url} aria-label="Link do portal" />
                <Button variant="outline" onClick={async () => { await navigator.clipboard.writeText(link.url); setCopied(true); }}>
                  <Copy aria-hidden />
                  {copied ? "Copiado" : "Copiar"}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {link.whatsapp ? (
                  <a href={link.whatsapp} target="_blank" rel="noreferrer" className={buttonVariants()}>
                    <MessageCircle aria-hidden />
                    Enviar pelo WhatsApp
                  </a>
                ) : null}
                <a href={link.url} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline" })}>
                  <ExternalLink aria-hidden />
                  Ver como o paciente
                </a>
                <Button
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await revokePortalLinks(patientId);
                      if (r.error) setMessage({ status: "error", message: r.error });
                      else {
                        setLink(null);
                        setMessage({ status: "success", message: "Todos os links deste paciente foram desativados." });
                      }
                    })
                  }
                >
                  Desativar links
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
