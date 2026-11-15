"use client";

import { useActionState } from "react";

import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { SwitchField } from "@/components/forms/switch-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionState } from "@/lib/action-state";

import { saveFiscalSettings } from "../actions";

type Settings = {
  enabled: boolean;
  auto_issue: boolean;
  municipal_inscription: string | null;
  simples_nacional: boolean;
  cnae: string | null;
  municipal_service_code: string | null;
  municipal_service_name: string | null;
  service_description: string;
  iss_rate: number;
  retain_iss: boolean;
  synced_at: string | null;
} | null;

export function FiscalSettingsForm({ settings, email, connected }: { settings: Settings; email: string; connected: boolean }) {
  const [state, action] = useActionState(saveFiscalSettings, { status: "idle" } as ActionState);
  const v = state.status === "error" ? state.values : undefined;
  const e = state.fieldErrors;
  return (
    <form action={action} className="space-y-5">
      <FormMessage state={state} />
      {!connected ? <p className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">Conecte a conta Asaas da clínica em Configurações &gt; Cobrança online: a nota é emitida por ela.</p> : null}
      <SwitchField name="enabled" label="Emitir notas fiscais" defaultChecked={settings?.enabled ?? false} />
      <SwitchField name="auto_issue" label="Emitir automaticamente ao receber" description="Cada pagamento recebido (no caixa ou online) gera a nota sozinho." defaultChecked={settings?.auto_issue ?? false} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Inscrição municipal" name="municipal_inscription" defaultValue={v?.municipal_inscription ?? settings?.municipal_inscription ?? ""} />
        <FormField label="CNAE (opcional)" name="cnae" defaultValue={v?.cnae ?? settings?.cnae ?? ""} />
        <FormField label="Código do serviço na prefeitura" name="municipal_service_code" placeholder="Ex.: 04.12" defaultValue={v?.municipal_service_code ?? settings?.municipal_service_code ?? ""} errors={e?.municipal_service_code} />
        <FormField label="Alíquota de ISS (%)" name="iss_rate" inputMode="decimal" defaultValue={v?.iss_rate ?? String(settings?.iss_rate ?? "").replace(".", ",")} errors={e?.iss_rate} />
      </div>
      <FormField label="Nome do serviço na prefeitura (opcional)" name="municipal_service_name" defaultValue={v?.municipal_service_name ?? settings?.municipal_service_name ?? ""} />
      <FormField label="Descrição na nota" name="service_description" defaultValue={v?.service_description ?? settings?.service_description ?? "Serviços odontológicos"} errors={e?.service_description} />
      <SwitchField name="simples_nacional" label="Optante pelo Simples Nacional" defaultChecked={settings?.simples_nacional ?? true} />
      <SwitchField name="retain_iss" label="ISS retido pelo tomador" defaultChecked={settings?.retain_iss ?? false} />
      <fieldset className="space-y-3 rounded-xl border p-4">
        <legend className="px-1 text-sm font-medium">Envio ao Asaas</legend>
        <FormField label="E-mail fiscal" name="email" type="email" defaultValue={v?.email ?? email} />
        <div className="space-y-1.5">
          <Label htmlFor="cert">Certificado digital A1 (.pfx), se a prefeitura exigir</Label>
          <Input id="cert" name="certificate" type="file" accept=".pfx,.p12,application/x-pkcs12" />
        </div>
        <FormField label="Senha do certificado" name="certificate_password" type="password" autoComplete="off" errors={e?.certificate_password} />
        <p className="text-xs text-muted-foreground">O certificado e a senha vão direto para o Asaas e não ficam guardados no sistema.{settings?.synced_at ? " Dados fiscais já enviados." : ""}</p>
      </fieldset>
      <SubmitButton>Salvar</SubmitButton>
    </form>
  );
}
