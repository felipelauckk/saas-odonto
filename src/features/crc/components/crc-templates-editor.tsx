"use client";

import { useState, useTransition } from "react";

import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { renderTemplate } from "@/lib/messaging/render";

import { saveCrcTemplate } from "../actions";
import { crcQueues, queueLabels, type CrcQueue } from "../labels";

const SAMPLE = { paciente: "Ana", clinica: "Clínica Sorriso", valor: "R$ 350,00" };

function CrcTemplateCard({ queue, initial }: { queue: CrcQueue; initial: string }) {
  const [body, setBody] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [message, setMessage] = useState<{ status: "error" | "success"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-2 rounded-xl border p-4">
      <Label htmlFor={`crc-${queue}`}>{queueLabels[queue]}</Label>
      {message ? <FormMessage state={message} /> : null}
      <Textarea id={`crc-${queue}`} rows={3} value={body} onChange={(e) => { setBody(e.target.value); setMessage(null); }} />
      <p className="rounded-lg bg-muted/40 px-3 py-2 text-sm"><span className="text-muted-foreground">Prévia: </span>{renderTemplate(body, SAMPLE)}</p>
      <Button
        type="button"
        size="sm"
        disabled={pending || body === saved}
        onClick={() =>
          startTransition(async () => {
            const r = await saveCrcTemplate(queue, body);
            if (r.error) setMessage({ status: "error", message: r.error });
            else {
              setSaved(body);
              setMessage({ status: "success", message: "Mensagem salva." });
            }
          })
        }
      >
        Salvar
      </Button>
    </div>
  );
}

/** Mensagens prontas de WhatsApp de cada fila da CRC (abertas pelo botão, não enviadas sozinhas). */
export function CrcTemplatesEditor({ templates }: { templates: { queue: CrcQueue; body: string }[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {crcQueues.map((q) => {
        const t = templates.find((x) => x.queue === q);
        return t ? <CrcTemplateCard key={q} queue={q} initial={t.body} /> : null;
      })}
    </div>
  );
}
