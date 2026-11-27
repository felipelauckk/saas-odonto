"use client";

import { useState } from "react";
import { Copy, MessageCircle } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type Props = {
  title: string;
  description: string;
  url: string;
  /** Texto do WhatsApp (o link vai no fim). */
  message: string;
  phone: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Link público para copiar ou mandar pelo WhatsApp do paciente. */
export function ShareLinkDialog({ title, description, url, message, phone, open, onOpenChange }: Props) {
  const [copied, setCopied] = useState(false);
  const text = encodeURIComponent(`${message} ${url}`);
  const whatsapp = phone ? `https://wa.me/55${phone}?text=${text}` : `https://wa.me/?text=${text}`;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input readOnly value={url} aria-label={title} onFocus={(e) => e.currentTarget.select()} />
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              <Copy aria-hidden />
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>
          <a href={whatsapp} target="_blank" rel="noreferrer" className={buttonVariants()}>
            <MessageCircle aria-hidden />
            Enviar pelo WhatsApp
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
