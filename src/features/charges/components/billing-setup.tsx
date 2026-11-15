"use client";

import { useState, useTransition } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";

import { FormMessage } from "@/components/forms/form-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";

import { connectAsaasAction, deleteDunningStep, disconnectAsaasAction, saveDunningStep } from "../actions";

type Connection = { environment: string; api_key_hint: string | null; webhook_token: string; connected_at: string | null } | null;

function useRun() {
  const [message, setMessage] = useState<{ status: "error" | "success"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<{ error?: string }>, ok: string, after?: () => void) =>
    startTransition(async () => {
      const r = await fn();
      setMessage(r.error ? { status: "error", message: r.error } : { status: "success", message: ok });
      if (!r.error) after?.();
    });
  return { message, pending, run };
}

export function ConnectionSetup({ connection, webhookUrl, secretsReady }: { connection: Connection; webhookUrl: string; secretsReady: boolean }) {
  const [apiKey, setApiKey] = useState("");
  const [environment, setEnvironment] = useState<"sandbox" | "production">((connection?.environment as "sandbox" | "production") ?? "sandbox");
  const [copied, setCopied] = useState<string | null>(null);
  const { message, pending, run } = useRun();
  const connected = Boolean(connection?.connected_at);
  const copy = async (v: string, what: string) => {
    await navigator.clipboard.writeText(v);
    setCopied(what);
  };

  return (
    <div className="space-y-4">
      {message ? <FormMessage state={message} /> : null}
      {!secretsReady ? (
        <p className="rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          O servidor ainda não tem a chave de criptografia (CLINIC_SECRETS_KEY). Sem ela, não dá para guardar a chave do Asaas.
        </p>
      ) : null}
      {connected ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border p-4 text-sm">
          <Badge>Conectado</Badge>
          <span>
            {connection!.environment === "production" ? "Produção" : "Sandbox (testes)"} · chave terminando em {connection!.api_key_hint} · desde {formatDateTime(connection!.connected_at!)}
          </span>
          <Button variant="ghost" size="sm" className="ml-auto" disabled={pending} onClick={() => run(() => disconnectAsaasAction(), "Conta desconectada.")}>
            Desconectar
          </Button>
        </div>
      ) : null}
      <div className="space-y-3 rounded-xl border p-4">
        <p className="text-sm font-medium">{connected ? "Trocar chave" : "Conectar a conta Asaas da clínica"}</p>
        <p className="text-sm text-muted-foreground">No Asaas: Integrações &gt; Chave de API. O dinheiro das cobranças vai direto para a conta da clínica.</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="asaas-key">Chave de API</Label>
            <Input id="asaas-key" type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="$aact_..." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="asaas-env">Ambiente</Label>
            <select id="asaas-env" value={environment} onChange={(e) => setEnvironment(e.target.value as "sandbox" | "production")} className="h-9 rounded-lg border bg-background px-2.5 text-sm pointer-coarse:h-11">
              <option value="sandbox">Sandbox (testes)</option>
              <option value="production">Produção</option>
            </select>
          </div>
        </div>
        <Button disabled={pending || !apiKey.trim() || !secretsReady} onClick={() => run(() => connectAsaasAction({ apiKey, environment }), "Conta conectada.", () => setApiKey(""))}>
          {pending ? "Conferindo..." : "Conectar"}
        </Button>
        <p className="text-xs text-muted-foreground">A chave é conferida no Asaas e guardada criptografada. Ninguém da equipe consegue vê-la depois.</p>
      </div>
      {connection ? (
        <div className="space-y-3 rounded-xl border p-4">
          <p className="text-sm font-medium">Baixa automática (webhook)</p>
          <p className="text-sm text-muted-foreground">
            No Asaas, em Integrações &gt; Webhooks, crie um webhook de cobranças com o endereço e o token abaixo. Assim, quando o paciente paga, a parcela é baixada e entra no caixa sozinha.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="wh-url">Endereço</Label>
            <div className="flex gap-2">
              <Input id="wh-url" readOnly value={webhookUrl} />
              <Button variant="outline" onClick={() => copy(webhookUrl, "url")}><Copy aria-hidden />{copied === "url" ? "Copiado" : "Copiar"}</Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wh-token">Token de autenticação</Label>
            <div className="flex gap-2">
              <Input id="wh-token" readOnly value={connection.webhook_token} className="font-mono text-xs" />
              <Button variant="outline" onClick={() => copy(connection.webhook_token, "token")}><Copy aria-hidden />{copied === "token" ? "Copiado" : "Copiar"}</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type Step = { id: string; offset_days: number; body: string; active: boolean };

const offsetLabel = (d: number) => (d < 0 ? `${-d} ${d === -1 ? "dia" : "dias"} antes do vencimento` : d === 0 ? "No dia do vencimento" : `${d} ${d === 1 ? "dia" : "dias"} de atraso`);

function StepRow({ step }: { step: Step }) {
  const [body, setBody] = useState(step.body);
  const [active, setActive] = useState(step.active);
  const { message, pending, run } = useRun();
  const dirty = body !== step.body || active !== step.active;
  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="flex-1 text-sm font-medium">{offsetLabel(step.offset_days)}</span>
        <Label className="flex items-center gap-2 font-normal pointer-coarse:min-h-11">
          <Switch checked={active} onCheckedChange={setActive} aria-label={`${offsetLabel(step.offset_days)} ativa`} />
          {active ? "Ativa" : "Desligada"}
        </Label>
        <Button variant="ghost" size="icon-sm" aria-label={`Excluir etapa: ${offsetLabel(step.offset_days)}`} disabled={pending} onClick={() => run(() => deleteDunningStep(step.id), "Etapa excluída.")}>
          <Trash2 />
        </Button>
      </div>
      <Textarea aria-label={`Mensagem: ${offsetLabel(step.offset_days)}`} rows={2} value={body} onChange={(e) => setBody(e.target.value)} />
      {message ? <FormMessage state={message} /> : null}
      {dirty ? <Button size="sm" disabled={pending} onClick={() => run(() => saveDunningStep({ id: step.id, offsetDays: step.offset_days, body, active }), "Etapa salva.")}>Salvar</Button> : null}
    </li>
  );
}

export function DunningSetup({ steps }: { steps: Step[] }) {
  const [offset, setOffset] = useState("30");
  const { message, pending, run } = useRun();
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Mensagens automáticas pelo WhatsApp para parcelas em aberto. Param sozinhas quando a parcela é paga ou marcada como “em negociação”. Variáveis: {"{{paciente}}"}, {"{{clinica}}"}, {"{{valor}}"}, {"{{vencimento}}"} e {"{{link}}"} (link da cobrança online, quando houver).
      </p>
      <ul className="divide-y rounded-xl border">
        {steps.map((s) => (
          <StepRow key={`${s.id}-${s.body}-${s.active}`} step={s} />
        ))}
      </ul>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="new-offset">Nova etapa: dias em relação ao vencimento</Label>
          <Input id="new-offset" inputMode="numeric" className="w-32" value={offset} onChange={(e) => setOffset(e.target.value)} />
        </div>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            run(
              () => saveDunningStep({ offsetDays: Number(offset), body: "Olá, {{paciente}}! A parcela de {{valor}} (vencimento {{vencimento}}) está em aberto. {{link}}", active: true }),
              "Etapa criada.",
            )
          }
        >
          <Plus aria-hidden />
          Adicionar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Use número negativo para antes do vencimento (ex.: -3) e positivo para atraso (ex.: 30).</p>
      {message ? <FormMessage state={message} /> : null}
    </div>
  );
}
