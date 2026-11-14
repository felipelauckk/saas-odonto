"use client";

import { useState, useTransition } from "react";

import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { renderTemplate, TEMPLATE_VARIABLES } from "@/lib/messaging/render";
import type { MessageKind } from "@/lib/messaging/types";

import { saveMessageTemplate } from "../actions";

const KIND_INFO: Record<MessageKind, { title: string; description: string }> = {
  appointment_reminder: { title: "Lembrete de consulta", description: "Enviado no dia anterior, com botão para confirmar." },
  appointment_confirmation: { title: "Confirmação", description: "Resposta quando o paciente confirma pelo botão." },
  birthday: { title: "Aniversário", description: "Enviado no dia do aniversário do paciente." },
};

const SAMPLE = { paciente: "Ana", clinica: "Clínica Sorriso", data: "segunda-feira, 16 de novembro", hora: "09:30", profissional: "Dra. Beatriz" };

function TemplateCard({ template }: { template: { id: string; kind: MessageKind; body: string; active: boolean } }) {
  const [body, setBody] = useState(template.body);
  const [active, setActive] = useState(template.active);
  const [message, setMessage] = useState<{ status: "error" | "success"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const info = KIND_INFO[template.kind];
  const dirty = body !== template.body || active !== template.active;

  function save() {
    startTransition(async () => {
      const result = await saveMessageTemplate({ id: template.id, body, active });
      setMessage(result.error ? { status: "error", message: result.error } : { status: "success", message: result.message ?? "Salvo." });
    });
  }

  return (
    <section className="space-y-3 rounded-xl border p-5 sm:p-6" aria-labelledby={`tpl-${template.kind}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <h2 id={`tpl-${template.kind}`} className="text-base font-medium">
            {info.title}
          </h2>
          <p className="text-sm text-muted-foreground">{info.description}</p>
        </div>
        <Label className="flex items-center gap-2 font-normal pointer-coarse:min-h-11">
          <Switch checked={active} onCheckedChange={setActive} aria-label={`${info.title} ativo`} />
          {active ? "Ativo" : "Desligado"}
        </Label>
      </div>
      {message ? <FormMessage state={message} /> : null}
      <Label htmlFor={`body-${template.kind}`} className="sr-only">
        Texto: {info.title}
      </Label>
      <Textarea id={`body-${template.kind}`} rows={3} value={body} onChange={(e) => { setBody(e.target.value); setMessage(null); }} />
      <p className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
        <span className="text-muted-foreground">Prévia: </span>
        {renderTemplate(body, SAMPLE)}
      </p>
      <Button type="button" onClick={save} disabled={pending || !dirty}>
        {pending ? "Salvando..." : "Salvar"}
      </Button>
    </section>
  );
}

export function TemplatesEditor({ templates }: { templates: { id: string; kind: MessageKind; body: string; active: boolean }[] }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Variáveis: {TEMPLATE_VARIABLES.map((v) => `{{${v.key}}}`).join(", ")}.
      </p>
      {templates.map((t) => (
        <TemplateCard key={t.id} template={t} />
      ))}
    </div>
  );
}
