"use client";

import { useState, useTransition } from "react";
import { Copy, ExternalLink, MessageCircle } from "lucide-react";
import { cn } from "cn";

import { FormMessage } from "@/components/forms/form-message";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatIsoDate, todayIso } from "@/lib/dates";
import { formatCurrency } from "@/lib/format";
import { firstName, toWhatsAppNumber } from "@/lib/messaging/render";

import { cancelChargeAction, createChargeAction } from "../actions";
import type { ChargeView as Charge } from "../service";

export type ChargeableReceivable = { id: string; description: string; amount_cents: number; due_date: string };

const kindLabels = { pix: "Pix", boleto: "Boleto", link: "Link de pagamento" } as const;

/** Mostra a cobrança gerada: link, Pix copia e cola e envio pelo WhatsApp. */
export function ChargeView({ charge, patientName, phone, clinicName, onCanceled }: { charge: Charge; patientName: string; phone: string | null; clinicName: string; onCanceled?: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const wa = toWhatsAppNumber(phone);
  const text = [
    `Olá, ${firstName(patientName)}! Segue a cobrança de ${formatCurrency(charge.amountCents)} da ${clinicName}, com vencimento em ${formatIsoDate(charge.dueDate)}.`,
    charge.invoiceUrl ? `Pague por aqui: ${charge.invoiceUrl}` : "",
    charge.pixPayload ? `Pix copia e cola: ${charge.pixPayload}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const copy = async (value: string, what: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(what);
  };
  return (
    <div className="space-y-3">
      <p className="text-sm">
        {kindLabels[charge.kind]} de <strong className="tabular-nums">{formatCurrency(charge.amountCents)}</strong>
        {charge.installments > 1 ? ` em até ${charge.installments}x no cartão` : ""} · vence {formatIsoDate(charge.dueDate)}
      </p>
      {error ? <FormMessage state={{ status: "error", message: error }} /> : null}
      {charge.pixPayload ? (
        <div className="space-y-1.5">
          <Label htmlFor={`pix-${charge.id}`}>Pix copia e cola</Label>
          <div className="flex gap-2">
            <Input id={`pix-${charge.id}`} readOnly value={charge.pixPayload} className="font-mono text-xs" />
            <Button variant="outline" onClick={() => copy(charge.pixPayload!, "pix")}>
              <Copy aria-hidden />
              {copied === "pix" ? "Copiado" : "Copiar"}
            </Button>
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {wa ? (
          <a href={`https://wa.me/${wa}?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" className={buttonVariants({ size: "sm" })}>
            <MessageCircle aria-hidden />
            Enviar pelo WhatsApp
          </a>
        ) : null}
        {charge.invoiceUrl ? (
          <>
            <Button variant="outline" size="sm" onClick={() => copy(charge.invoiceUrl!, "link")}>
              <Copy aria-hidden />
              {copied === "link" ? "Link copiado" : "Copiar link"}
            </Button>
            <a href={charge.invoiceUrl} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <ExternalLink aria-hidden />
              Abrir
            </a>
          </>
        ) : null}
        {charge.bankSlipUrl ? (
          <a href={charge.bankSlipUrl} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Boleto (PDF)
          </a>
        ) : null}
        {onCanceled && (charge.status === "pending" || charge.status === "overdue") ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await cancelChargeAction(charge.id);
                if (r.error) setError(r.error);
                else onCanceled();
              })
            }
          >
            Cancelar cobrança
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Escolhe parcelas e forma e gera a cobrança no Asaas da clínica. */
export function ChargeForm({
  receivables,
  preselected,
  patientName,
  phone,
  clinicName,
}: {
  receivables: ChargeableReceivable[];
  preselected: string[];
  patientName: string;
  phone: string | null;
  clinicName: string;
}) {
  const [selected, setSelected] = useState<string[]>(preselected);
  const [kind, setKind] = useState<"pix" | "boleto" | "link">("link");
  const [installments, setInstallments] = useState(1);
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Charge | null>(null);
  const [pending, startTransition] = useTransition();
  const total = receivables.filter((r) => selected.includes(r.id)).reduce((s, r) => s + r.amount_cents, 0);

  if (created) return <ChargeView charge={created} patientName={patientName} phone={phone} clinicName={clinicName} />;

  return (
    <div className="space-y-4">
      {error ? <FormMessage state={{ status: "error", message: error }} /> : null}
      {receivables.length > 1 ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Parcelas</legend>
          {receivables.map((r) => (
            <label key={r.id} className="flex items-center gap-3 text-sm pointer-coarse:min-h-11">
              <Checkbox checked={selected.includes(r.id)} onCheckedChange={(v) => setSelected((s) => (v ? [...s, r.id] : s.filter((x) => x !== r.id)))} />
              <span className="flex-1">
                {r.description} · vence {formatIsoDate(r.due_date)}
              </span>
              <span className="tabular-nums">{formatCurrency(r.amount_cents)}</span>
            </label>
          ))}
        </fieldset>
      ) : null}
      <div className="space-y-1.5">
        <p className="text-sm font-medium" id="charge-kind">
          Forma
        </p>
        <div className="grid grid-cols-3 gap-2" role="group" aria-labelledby="charge-kind">
          {(["link", "pix", "boleto"] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => {
                setKind(k);
                if (k !== "link") setInstallments(1);
              }}
              className={cn("h-9 rounded-lg border px-2 text-sm font-medium pointer-coarse:h-11", kind === k ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}
            >
              {k === "link" ? "Link" : kindLabels[k]}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {kind === "link" ? "O paciente escolhe cartão, Pix ou boleto na página do Asaas." : kind === "pix" ? "Gera Pix copia e cola." : "Gera boleto bancário."}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {kind === "link" ? (
          <div className="space-y-1.5">
            <Label htmlFor="charge-installments">Parcelar no cartão em até</Label>
            <select
              id="charge-installments"
              value={installments}
              onChange={(e) => setInstallments(Number(e.target.value))}
              className="h-9 w-full rounded-lg border bg-background px-2.5 text-sm pointer-coarse:h-11"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? "À vista" : `${n}x`}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="charge-due">Vencimento (opcional)</Label>
          <Input id="charge-due" type="date" min={todayIso()} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t pt-4">
        <span className="text-sm">
          Total: <strong className="tabular-nums">{formatCurrency(total)}</strong>
        </span>
        <Button
          disabled={pending || !selected.length}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const r = await createChargeAction({ receivableIds: selected, kind, installments, dueDate: dueDate || null });
              if (r.error || !r.charge) setError(r.error ?? "Não foi possível gerar a cobrança.");
              else setCreated(r.charge);
            })
          }
        >
          {pending ? "Gerando..." : "Gerar cobrança"}
        </Button>
      </div>
    </div>
  );
}
