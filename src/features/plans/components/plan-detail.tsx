"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, FileDown, Pencil, Send, XCircle } from "lucide-react";
import { cn } from "cn";

import { FormMessage } from "@/components/forms/form-message";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatIsoDate } from "@/lib/dates";
import { formatCurrency, formatDateTime } from "@/lib/format";

import { faceLabel, type Face } from "@/features/clinical/odontogram";

import { setItemDone, setPlanStatus } from "../actions";
import { itemStatusLabels, OPEN_STATUSES, type ItemStatus, type PlanStatus } from "../labels";
import { ApproveForm } from "./approve-form";
import { LabCostInput } from "@/features/commissions/components/lab-cost-input";

type Props = {
  plan: {
    id: string;
    status: PlanStatus;
    total_cents: number;
    discount_cents: number;
    installments: number;
    notes: string | null;
    valid_until: string | null;
    created_at: string;
    approved_at: string | null;
    patientId: string;
    patientName: string;
    professionalName: string;
    paymentMethodName: string | null;
  };
  items: { id: string; description: string; tooth: number | null; faces: string[]; price_cents: number; lab_cost_cents: number; status: ItemStatus; done_at: string | null }[];
  receivables: { id: string; amount_cents: number; due_date: string; installment_number: number; installment_total: number; status: string }[];
  paymentMethods: { id: string; name: string }[];
  canMarkDone: boolean;
  canEditLab?: boolean;
};

const receivableLabels: Record<string, string> = { open: "Em aberto", paid: "Pago", overdue: "Vencido", canceled: "Cancelado" };

export function PlanDetailView({ plan, items, receivables, paymentMethods, canMarkDone, canEditLab = false }: Props) {
  const [dialog, setDialog] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const open = OPEN_STATUSES.includes(plan.status);
  const decided = !open && plan.status !== "rejected";

  const run = (fn: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const result = await fn();
      if (result.error) setError(result.error);
      else setDialog(null);
    });

  const approvedTotal = items.filter((i) => i.status === "approved" || i.status === "done").reduce((s, i) => s + i.price_cents, 0);

  return (
    <div className="space-y-6">
      {error ? <FormMessage state={{ status: "error", message: error }} /> : null}

      <div className="flex flex-wrap gap-2">
        {open ? (
          <>
            <Button onClick={() => setDialog("approve")}>
              <CheckCircle2 aria-hidden />
              Aprovar
            </Button>
            {plan.status === "draft" ? (
              <Button variant="outline" disabled={pending} onClick={() => run(() => setPlanStatus(plan.id, "presented"))}>
                <Send aria-hidden />
                Marcar como apresentado
              </Button>
            ) : null}
            <Link href={`/orcamentos/${plan.id}/editar`} className={buttonVariants({ variant: "outline" })}>
              <Pencil aria-hidden />
              Editar
            </Link>
            <Button variant="ghost" onClick={() => setDialog("reject")}>
              <XCircle aria-hidden />
              Recusar
            </Button>
          </>
        ) : null}
        <a href={`/orcamentos/${plan.id}/pdf`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline" })}>
          <FileDown aria-hidden />
          PDF
        </a>
        <Link href={`/pacientes/${plan.patientId}/documentos?novo=contract&orcamento=${plan.id}`} className={buttonVariants({ variant: "outline" })}>
          Gerar contrato
        </Link>
        <Link href={`/pacientes/${plan.patientId}/documentos?novo=consent&orcamento=${plan.id}`} className={buttonVariants({ variant: "ghost" })}>
          Termo de consentimento
        </Link>
      </div>

      <section className="rounded-xl border" aria-label="Itens do orçamento">
        <ul className="divide-y">
          {items.map((item) => {
            const done = item.status === "done";
            const markable = canMarkDone && (item.status === "approved" || done);
            return (
              <li key={item.id} className={cn("flex items-center gap-3 px-4 py-3 sm:px-5", item.status === "rejected" && "text-muted-foreground")}>
                {markable ? (
                  <Checkbox
                    aria-label={`${item.description}: realizado`}
                    checked={done}
                    disabled={pending}
                    onCheckedChange={(c) => run(() => setItemDone(item.id, c === true))}
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-medium", item.status === "rejected" && "line-through")}>{item.description}</p>
                  <p className="text-sm text-muted-foreground">
                    {[
                      item.tooth ? `Dente ${item.tooth}${item.faces.length ? ` · ${item.faces.map((f) => faceLabel(f as Face, item.tooth!)).join(", ")}` : ""}` : null,
                      decided ? itemStatusLabels[item.status] : null,
                      done && item.done_at ? `em ${formatDateTime(item.done_at)}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                {canEditLab && (item.status === "approved" || item.status === "done") ? (
                  <LabCostInput itemId={item.id} initialCents={item.lab_cost_cents} label={item.description} />
                ) : null}
                <span className="text-sm tabular-nums">{formatCurrency(item.price_cents)}</span>
              </li>
            );
          })}
        </ul>
        <dl className="space-y-1 border-t px-4 py-3 text-sm sm:px-5">
          {decided ? (
            <>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Aprovado</dt>
                <dd className="tabular-nums">{formatCurrency(approvedTotal)}</dd>
              </div>
              {plan.discount_cents ? (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Desconto</dt>
                  <dd className="tabular-nums">- {formatCurrency(plan.discount_cents)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between font-medium">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatCurrency(approvedTotal - plan.discount_cents)}</dd>
              </div>
            </>
          ) : (
            <div className="flex justify-between font-medium">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatCurrency(plan.total_cents)}</dd>
            </div>
          )}
        </dl>
      </section>

      {canMarkDone && decided ? (
        <p className="text-xs text-muted-foreground">Marque os itens realizados. O orçamento conclui quando todos os aprovados forem feitos.</p>
      ) : null}

      {receivables.length ? (
        <section className="space-y-2" aria-labelledby="parcelas">
          <h2 id="parcelas" className="text-sm font-medium text-muted-foreground">
            Parcelas{plan.paymentMethodName ? ` · ${plan.paymentMethodName}` : ""}
          </h2>
          <ul className="divide-y rounded-xl border">
            {receivables.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-5">
                <span>
                  {r.installment_total > 1 ? `${r.installment_number}/${r.installment_total} · ` : ""}vence {formatIsoDate(r.due_date)}
                </span>
                <span className="flex items-center gap-3">
                  <Badge variant={r.status === "paid" ? "outline" : r.status === "overdue" ? "destructive" : "secondary"}>
                    {receivableLabels[r.status] ?? r.status}
                  </Badge>
                  <span className="tabular-nums">{formatCurrency(r.amount_cents)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {plan.notes ? <p className="whitespace-pre-line rounded-xl border p-4 text-sm">{plan.notes}</p> : null}

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          {dialog === "approve" ? (
            <>
              <DialogHeader>
                <DialogTitle>Aprovar orçamento</DialogTitle>
                <DialogDescription>As parcelas vão para o financeiro como contas a receber.</DialogDescription>
              </DialogHeader>
              <ApproveForm
                planId={plan.id}
                items={items}
                paymentMethods={paymentMethods}
                onDone={() => setDialog(null)}
                onCancel={() => setDialog(null)}
              />
            </>
          ) : null}
          {dialog === "reject" ? (
            <>
              <DialogHeader>
                <DialogTitle>Recusar orçamento?</DialogTitle>
                <DialogDescription>O orçamento fica guardado como recusado e não gera cobrança.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialog(null)}>
                  Voltar
                </Button>
                <Button variant="destructive" disabled={pending} onClick={() => run(() => setPlanStatus(plan.id, "rejected"))}>
                  Recusar
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
