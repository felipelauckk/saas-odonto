"use client";

import { useState, useTransition } from "react";

import { FormMessage } from "@/components/forms/form-message";
import { FormSection, FormSections, FormSectionsFooter } from "@/components/forms/form-sections";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { queueLabels, type CrcQueue } from "@/features/crc/labels";

import { saveAiSettings } from "../actions";

type Settings = {
  voice_enabled: boolean;
  assistant_enabled: boolean;
  followup_enabled: boolean;
  insights_enabled: boolean;
  monthly_limit_usd: number;
  assistant_info: string;
  whatsapp_phone_number_id: string | null;
  followup_queues: CrcQueue[];
  followup_min_days: number;
};

const FOLLOWUP_QUEUES: CrcQueue[] = ["open_quotes", "untreated", "no_shows", "overdue_returns"];

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description: string }) {
  return (
    <Label className="flex items-start gap-3 rounded-xl border p-4 font-normal pointer-coarse:min-h-11">
      <Switch checked={checked} onCheckedChange={onChange} className="mt-0.5" />
      <span className="space-y-0.5">
        <span className="block font-medium">{label}</span>
        <span className="block text-sm text-muted-foreground">{description}</span>
      </span>
    </Label>
  );
}

export function AiSettings({ settings }: { settings: Settings }) {
  const [s, setS] = useState(settings);
  const [limit, setLimit] = useState(String(settings.monthly_limit_usd).replace(".", ","));
  const [minDays, setMinDays] = useState(String(settings.followup_min_days));
  const [message, setMessage] = useState<{ status: "error" | "success"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((x) => ({ ...x, [k]: v }));

  return (
    <FormSections>
      <FormSection id="ai-recursos" title="Recursos" description="Ligue só o que a clínica vai usar. Cada uso conta no limite do mês.">
        {message ? <FormMessage state={message} /> : null}
        <div className="grid gap-3 lg:grid-cols-2">
          <Toggle checked={s.voice_enabled} onChange={(v) => set("voice_enabled", v)} label="Registro por voz" description="Botão “Ditar” na evolução, na anamnese e no orçamento. O profissional revisa antes de salvar." />
          <Toggle checked={s.insights_enabled} onChange={(v) => set("insights_enabled", v)} label="Perguntas e resumo do mês" description="Perguntas em português sobre os relatórios e resumo mensal para a gestão." />
          <Toggle checked={s.assistant_enabled} onChange={(v) => set("assistant_enabled", v)} label="Assistente de WhatsApp" description="Responde dúvidas, marca, remarca e desmarca consultas pela grade real; chama a equipe quando precisa." />
          <Toggle checked={s.followup_enabled} onChange={(v) => set("followup_enabled", v)} label="Follow-up automático da CRC" description="Mensagens das filas da CRC pelo WhatsApp em horário comercial, com limite por paciente." />
        </div>
      </FormSection>

      <FormSection id="ai-assistente" title="Assistente de WhatsApp" description="O assistente só responde com o que estiver aqui e na agenda. Não coloque dados de pacientes.">
        <div className="space-y-1.5">
          <Label htmlFor="ai-info">Informações para o assistente</Label>
          <Textarea id="ai-info" rows={8} maxLength={8000} value={s.assistant_info} onChange={(e) => set("assistant_info", e.target.value)} placeholder={"Endereço, como chegar, estacionamento, horários de funcionamento, convênios (se não atende), formas de pagamento, preços que a clínica quer divulgar..."} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ai-phone">ID do número de WhatsApp da clínica (Meta)</Label>
          <Input id="ai-phone" inputMode="numeric" value={s.whatsapp_phone_number_id ?? ""} onChange={(e) => set("whatsapp_phone_number_id", e.target.value)} placeholder="Opcional" />
        </div>
      </FormSection>

      <FormSection id="ai-followup" title="Follow-up da CRC" description="Quais filas recebem mensagem e com que frequência.">
        <div className="space-y-1.5 sm:max-w-xs">
          <Label htmlFor="ai-days">No máximo 1 mensagem a cada (dias)</Label>
          <Input id="ai-days" inputMode="numeric" value={minDays} onChange={(e) => setMinDays(e.target.value)} />
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Filas trabalhadas pelo follow-up</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {FOLLOWUP_QUEUES.map((q) => (
              <label key={q} className="flex items-center gap-2 text-sm pointer-coarse:min-h-11">
                <Checkbox checked={s.followup_queues.includes(q)} onCheckedChange={(v) => set("followup_queues", v ? [...s.followup_queues, q] : s.followup_queues.filter((x) => x !== q))} />
                {queueLabels[q]}
              </label>
            ))}
          </div>
        </fieldset>
      </FormSection>

      <FormSection id="ai-limite" title="Limite de gasto" description="Ao atingir o limite, os recursos de IA param até o mês seguinte.">
        <div className="space-y-1.5 sm:max-w-xs">
          <Label htmlFor="ai-limit">Limite de gasto por mês (US$)</Label>
          <Input id="ai-limit" inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} />
        </div>
      </FormSection>

      <FormSectionsFooter>
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await saveAiSettings({
                voiceEnabled: s.voice_enabled,
                assistantEnabled: s.assistant_enabled,
                followupEnabled: s.followup_enabled,
                insightsEnabled: s.insights_enabled,
                monthlyLimitUsd: Number(limit.replace(",", ".")),
                assistantInfo: s.assistant_info,
                whatsappPhoneNumberId: s.whatsapp_phone_number_id ?? "",
                followupQueues: s.followup_queues,
                followupMinDays: Number(minDays),
              });
              setMessage(r.error ? { status: "error", message: r.error } : { status: "success", message: "Configuração salva." });
            })
          }
        >
          {pending ? "Salvando..." : "Salvar"}
        </Button>
      </FormSectionsFooter>
    </FormSections>
  );
}
