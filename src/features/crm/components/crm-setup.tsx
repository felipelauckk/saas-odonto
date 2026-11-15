"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Copy, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";

import { FormDialog } from "@/components/forms/form-dialog";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SelectField } from "@/components/forms/select-field";
import { SwitchField } from "@/components/forms/switch-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPhone } from "@/lib/documents";
import { formatCurrency } from "@/lib/format";
import { centsToInput } from "@/lib/money";

import { deleteStage, moveStage, regenerateLeadFormLink, saveCampaign, savePartner, saveStage } from "../actions";
import { leadSources, sourceLabels, type LeadSource } from "../labels";
import type { CrmStage } from "../queries";

function useRun() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<{ error?: string }>, after?: () => void) =>
    startTransition(async () => {
      const r = await fn();
      setError(r.error ?? null);
      if (!r.error) after?.();
    });
  return { error, pending, run };
}

function StageRow({ stage, first, last }: { stage: CrmStage; first: boolean; last: boolean }) {
  const [name, setName] = useState(stage.name);
  const { error, pending, run } = useRun();
  const open = stage.kind === "open";
  return (
    <li className="space-y-1 px-4 py-2">
      <div className="flex items-center gap-2">
        <Input aria-label={`Nome da etapa ${stage.name}`} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} className="max-w-64" />
        {name !== stage.name ? <Button size="sm" disabled={pending} onClick={() => run(() => saveStage({ id: stage.id, name }))}>Salvar</Button> : null}
        {stage.kind !== "open" ? <Badge variant="secondary">{stage.kind === "won" ? "Ganho" : "Perda"}</Badge> : null}
        {stage.autoKey && open ? <span className="text-xs text-muted-foreground">automática</span> : null}
        <span className="ml-auto flex gap-1">
          {open ? (
            <>
              <Button variant="ghost" size="icon-sm" aria-label={`Subir ${stage.name}`} disabled={pending || first} onClick={() => run(() => moveStage(stage.id, "up"))}><ArrowUp /></Button>
              <Button variant="ghost" size="icon-sm" aria-label={`Descer ${stage.name}`} disabled={pending || last} onClick={() => run(() => moveStage(stage.id, "down"))}><ArrowDown /></Button>
            </>
          ) : null}
          {!stage.autoKey ? (
            <Button variant="ghost" size="icon-sm" aria-label={`Excluir ${stage.name}`} disabled={pending} onClick={() => run(() => deleteStage(stage.id))}><Trash2 /></Button>
          ) : null}
        </span>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </li>
  );
}

export function StagesSetup({ stages }: { stages: CrmStage[] }) {
  const [name, setName] = useState("");
  const { error, pending, run } = useRun();
  const open = stages.filter((s) => s.kind === "open");
  return (
    <div className="space-y-3">
      <ul className="divide-y rounded-xl border">
        {stages.map((s) => (
          <StageRow key={`${s.id}-${s.name}`} stage={s} first={open[0]?.id === s.id} last={open.at(-1)?.id === s.id} />
        ))}
      </ul>
      <div className="flex gap-2">
        <Input aria-label="Nova etapa" placeholder="Nova etapa (ex.: Retornar em 30 dias)" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} className="max-w-sm" />
        <Button variant="outline" disabled={pending || !name.trim()} onClick={() => run(() => saveStage({ name }), () => setName(""))}>
          <Plus aria-hidden />
          Adicionar etapa
        </Button>
      </div>
      {error ? <FormMessage state={{ status: "error", message: error }} /> : null}
      <p className="text-xs text-muted-foreground">
        Etapas automáticas avançam sozinhas quando o lead já é paciente: consulta marcada, comparecimento, orçamento apresentado e aprovado.
      </p>
    </div>
  );
}

type Campaign = { id: string; name: string; source: LeadSource | null; cost_cents: number; active: boolean };
type Partner = { id: string; name: string; phone: string | null; notes: string | null; active: boolean };

function CampaignFields({ c, values, errors }: { c?: Campaign; values?: Record<string, string>; errors?: Partial<Record<string, string[]>> }) {
  return (
    <>
      {c ? <input type="hidden" name="id" value={c.id} /> : null}
      <FormField label="Nome" name="name" defaultValue={values?.name ?? c?.name ?? ""} errors={errors?.name} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField name="source" label="Origem" defaultValue={values?.source ?? c?.source ?? "none"} options={[{ value: "none", label: "Qualquer" }, ...leadSources.map((s) => ({ value: s, label: sourceLabels[s] }))]} />
        <FormField label="Valor investido (R$)" name="cost" inputMode="decimal" placeholder="0,00" defaultValue={values?.cost ?? (c ? centsToInput(c.cost_cents) : "")} errors={errors?.cost} />
      </div>
      <SwitchField name="active" label="Ativa" defaultChecked={c?.active ?? true} />
    </>
  );
}

export function CampaignsSetup({ campaigns }: { campaigns: Campaign[] }) {
  return (
    <div className="space-y-3">
      <FormDialog title="Nova campanha" action={saveCampaign} submitLabel="Criar" trigger={<Button variant="outline"><Plus aria-hidden />Nova campanha</Button>}>
        {(state) => <CampaignFields values={state.values} errors={state.fieldErrors} />}
      </FormDialog>
      {campaigns.length ? (
        <ul className="divide-y rounded-xl border">
          {campaigns.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-2 text-sm">
              <span className="flex-1">
                {c.name}
                <span className="text-muted-foreground"> · {c.source ? sourceLabels[c.source] : "Qualquer origem"} · {formatCurrency(c.cost_cents)}</span>
              </span>
              {!c.active ? <Badge variant="secondary">Inativa</Badge> : null}
              <FormDialog title="Editar campanha" action={saveCampaign} trigger={<Button variant="ghost" size="icon" aria-label={`Editar ${c.name}`}><Pencil /></Button>}>
                {(state) => <CampaignFields c={c} values={state.values} errors={state.fieldErrors} />}
              </FormDialog>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function PartnerFields({ p, values, errors }: { p?: Partner; values?: Record<string, string>; errors?: Partial<Record<string, string[]>> }) {
  return (
    <>
      {p ? <input type="hidden" name="id" value={p.id} /> : null}
      <FormField label="Nome" name="name" defaultValue={values?.name ?? p?.name ?? ""} errors={errors?.name} />
      <FormField label="Telefone" name="phone" inputMode="tel" defaultValue={values?.phone ?? (p?.phone ? formatPhone(p.phone) : "")} errors={errors?.phone} />
      <FormField label="Observações" name="notes" defaultValue={values?.notes ?? p?.notes ?? ""} />
      <SwitchField name="active" label="Ativo" defaultChecked={p?.active ?? true} />
    </>
  );
}

export function PartnersSetup({ partners }: { partners: Partner[] }) {
  return (
    <div className="space-y-3">
      <FormDialog title="Novo parceiro" action={savePartner} submitLabel="Criar" trigger={<Button variant="outline"><Plus aria-hidden />Novo parceiro</Button>}>
        {(state) => <PartnerFields values={state.values} errors={state.fieldErrors} />}
      </FormDialog>
      {partners.length ? (
        <ul className="divide-y rounded-xl border">
          {partners.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-2 text-sm">
              <span className="flex-1">{p.name}{p.phone ? <span className="text-muted-foreground"> · {formatPhone(p.phone)}</span> : null}</span>
              {!p.active ? <Badge variant="secondary">Inativo</Badge> : null}
              <FormDialog title="Editar parceiro" action={savePartner} trigger={<Button variant="ghost" size="icon" aria-label={`Editar ${p.name}`}><Pencil /></Button>}>
                {(state) => <PartnerFields p={p} values={state.values} errors={state.fieldErrors} />}
              </FormDialog>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function PublicFormSetup({ url }: { url: string }) {
  const { error, pending, run } = useRun();
  const [copied, setCopied] = useState<string | null>(null);
  const embed = `<iframe src="${url}" title="Fale com a clínica" style="width:100%;max-width:480px;height:640px;border:0"></iframe>`;
  const copy = async (text: string, what: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(what);
  };
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <p className="text-sm font-medium">Link do formulário</p>
        <div className="flex gap-2">
          <Input readOnly value={url} aria-label="Link do formulário" />
          <Button variant="outline" onClick={() => copy(url, "link")}><Copy aria-hidden />{copied === "link" ? "Copiado" : "Copiar"}</Button>
        </div>
        <p className="text-xs text-muted-foreground">Acrescente <code>?origem=instagram</code> (ou google, anuncio…) e <code>&amp;campanha=&lt;id&gt;</code> para marcar de onde o lead veio.</p>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-medium">Código para colocar no site</p>
        <div className="flex gap-2">
          <Input readOnly value={embed} aria-label="Código para incorporar" className="font-mono text-xs" />
          <Button variant="outline" onClick={() => copy(embed, "embed")}><Copy aria-hidden />{copied === "embed" ? "Copiado" : "Copiar"}</Button>
        </div>
      </div>
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => regenerateLeadFormLink())}>
        <RefreshCw aria-hidden />
        Gerar novo link (o atual para de funcionar)
      </Button>
      {error ? <FormMessage state={{ status: "error", message: error }} /> : null}
    </div>
  );
}
