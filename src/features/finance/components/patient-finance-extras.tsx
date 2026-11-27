"use client";

import { useState, useTransition } from "react";
import { CalendarSync, PiggyBank, Plus } from "lucide-react";

import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatIsoDate, todayIso } from "@/lib/dates";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { parseBRLToCents } from "@/lib/money";

import { addManualCredit, createSubscription, endSubscription } from "../actions";

export type Subscription = {
  id: string;
  description: string;
  amount_cents: number;
  due_day: number;
  starts_on: string;
  ends_on: string | null;
  active: boolean;
};

export type CreditMove = { id: string; amount_cents: number; kind: string; notes: string | null; created_at: string };

const KIND_LABELS: Record<string, string> = { entrada: "Entrada", uso: "Uso", estorno: "Estorno" };

function NewSubscriptionDialog({ patientId, open, onOpenChange }: { patientId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [description, setDescription] = useState("Manutenção ortodôntica");
  const [amount, setAmount] = useState("");
  const [dueDay, setDueDay] = useState("10");
  const [startsOn, setStartsOn] = useState(todayIso());
  const [endsOn, setEndsOn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const cents = parseBRLToCents(amount);
    if (!cents) return setError("Informe o valor.");
    setError(null);
    startTransition(async () => {
      const r = await createSubscription({ patientId, description, amountCents: cents, dueDay: Number(dueDay), startsOn, endsOn: endsOn || null });
      if (r.error) setError(r.error);
      else onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4" noValidate>
          <DialogHeader>
            <DialogTitle>Nova mensalidade</DialogTitle>
            <DialogDescription>Uma parcela por mês entra em contas a receber, na régua de cobrança e na cobrança online.</DialogDescription>
          </DialogHeader>
          {error ? <FormMessage state={{ status: "error", message: error }} /> : null}
          <div className="space-y-1.5">
            <Label htmlFor="sub-description">Descrição</Label>
            <Input id="sub-description" maxLength={120} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="sub-amount">Valor mensal (R$)</Label>
              <Input id="sub-amount" inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-day">Dia do vencimento</Label>
              <Input id="sub-day" type="number" min={1} max={28} inputMode="numeric" value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-start">Início</Label>
              <Input id="sub-start" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-end">Fim (opcional)</Label>
              <Input id="sub-end" type="date" value={endsOn} min={startsOn} onChange={(e) => setEndsOn(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Criando..." : "Criar mensalidade"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreditDialog({ patientId, open, onOpenChange }: { patientId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const cents = parseBRLToCents(amount);
    if (!cents) return setError("Informe o valor.");
    startTransition(async () => {
      const r = await addManualCredit({ patientId, amountCents: cents, notes });
      if (r.error) setError(r.error);
      else onOpenChange(false);
    });
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4" noValidate>
          <DialogHeader>
            <DialogTitle>Lançar crédito</DialogTitle>
            <DialogDescription>Saldo a favor do paciente, para usar na baixa das próximas parcelas.</DialogDescription>
          </DialogHeader>
          {error ? <FormMessage state={{ status: "error", message: error }} /> : null}
          <div className="space-y-1.5">
            <Label htmlFor="credit-amount">Valor (R$)</Label>
            <Input id="credit-amount" inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="credit-notes">Motivo</Label>
            <Input id="credit-notes" maxLength={300} placeholder="Ex.: adiantamento do tratamento" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Lançando..." : "Lançar crédito"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Botões "+ Mensalidade" e "Lançar crédito" da aba Financeiro. */
export function PatientFinanceActions({ patientId, canManage }: { patientId: string; canManage: boolean }) {
  const [open, setOpen] = useState<"sub" | "credit" | null>(null);
  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen("sub")}>
        <Plus aria-hidden />
        Mensalidade
      </Button>
      {canManage ? (
        <Button type="button" variant="ghost" onClick={() => setOpen("credit")}>
          <PiggyBank aria-hidden />
          Lançar crédito
        </Button>
      ) : null}
      {open === "sub" ? <NewSubscriptionDialog patientId={patientId} open onOpenChange={(o) => !o && setOpen(null)} /> : null}
      {open === "credit" ? <CreditDialog patientId={patientId} open onOpenChange={(o) => !o && setOpen(null)} /> : null}
    </>
  );
}

/** Mensalidades e movimentos de crédito do paciente. */
export function PatientFinanceExtras({ subscriptions, credits }: { subscriptions: Subscription[]; credits: CreditMove[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (!subscriptions.length && !credits.length) return null;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {error ? <FormMessage state={{ status: "error", message: error }} /> : null}
      {subscriptions.length ? (
        <section aria-labelledby="mensalidades" className="space-y-3 rounded-card border bg-card p-5 shadow-card">
          <h2 id="mensalidades" className="type-section flex items-center gap-2">
            <CalendarSync className="size-4 text-muted-foreground" aria-hidden />
            Mensalidades
          </h2>
          <ul className="divide-y">
            {subscriptions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{s.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(s.amount_cents)} todo dia {s.due_day} · desde {formatIsoDate(s.starts_on)}
                    {s.ends_on ? ` · até ${formatIsoDate(s.ends_on)}` : ""}
                    {s.active ? "" : " · encerrada"}
                  </p>
                </div>
                {s.active ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      if (!window.confirm(`Encerrar a mensalidade "${s.description}"? As parcelas já geradas continuam.`)) return;
                      startTransition(async () => {
                        const r = await endSubscription(s.id);
                        setError(r.error ?? null);
                      });
                    }}
                  >
                    Encerrar
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {credits.length ? (
        <section aria-labelledby="credito-movimentos" className="space-y-3 rounded-card border bg-card p-5 shadow-card">
          <h2 id="credito-movimentos" className="type-section flex items-center gap-2">
            <PiggyBank className="size-4 text-muted-foreground" aria-hidden />
            Movimentos de crédito
          </h2>
          <ul className="divide-y">
            {credits.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <p>
                    {KIND_LABELS[c.kind] ?? c.kind}
                    {c.notes ? <span className="text-muted-foreground"> · {c.notes}</span> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(c.created_at)}</p>
                </div>
                <span className={c.amount_cents > 0 ? "font-semibold text-success tabular-nums" : "font-semibold tabular-nums"}>
                  {c.amount_cents > 0 ? "+" : "−"}
                  {formatCurrency(Math.abs(c.amount_cents))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
