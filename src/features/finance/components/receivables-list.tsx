"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileDown, MoreHorizontal } from "lucide-react";

import { FormMessage } from "@/components/forms/form-message";
import { SimpleSelect } from "@/components/forms/simple-select";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatIsoDate, todayIso } from "@/lib/dates";
import { formatCurrency } from "@/lib/format";
import { centsToInput, parseBRLToCents } from "@/lib/money";

import { setNegotiation } from "@/features/charges/actions";
import { issueInvoiceAction } from "@/features/invoices/actions";
import { ChargeForm, ChargeView } from "@/features/charges/components/charge-dialog";
import type { ChargeView as Charge } from "@/features/charges/service";

import { cancelReceivable, receivePayment, reversePayment } from "../actions";
import { receivableStatusLabels, type ReceivableStatus } from "../labels";

export type ReceivableItem = {
  id: string;
  description: string;
  amount_cents: number;
  due_date: string;
  status: ReceivableStatus;
  paid_amount_cents: number | null;
  fee_cents: number;
  patient_id: string;
  in_negotiation?: boolean;
  patients: { full_name: string; whatsapp?: string | null; phone?: string | null } | null;
  payment_methods: { name: string } | null;
};

type Props = {
  receivables: ReceivableItem[];
  paymentMethods: { id: string; name: string; fee_percent: number }[];
  canOperate: boolean;
  canManage: boolean;
  showPatient?: boolean;
  /** Cobrança online (Asaas da clínica). */
  online?: { enabled: boolean; clinicName: string; charges: Charge[] };
  /** Nota fiscal: ligada na clínica e notas já emitidas por recebimento. */
  invoices?: { enabled: boolean; byReceivable: Record<string, { status: string; pdfUrl: string | null }> };
};

function ReceiveForm({ receivable, paymentMethods, onDone }: { receivable: ReceivableItem; paymentMethods: Props["paymentMethods"]; onDone: () => void }) {
  const [amount, setAmount] = useState(centsToInput(receivable.amount_cents));
  const [method, setMethod] = useState(paymentMethods[0]?.id ?? "");
  const [date, setDate] = useState(todayIso());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const cents = parseBRLToCents(amount);
  const fee = paymentMethods.find((m) => m.id === method)?.fee_percent ?? 0;
  const feeCents = cents ? Math.round((cents * fee) / 100) : 0;

  function submit() {
    if (!cents) {
      setError("Valor inválido.");
      return;
    }
    startTransition(async () => {
      const result = await receivePayment({ receivableId: receivable.id, paidAmountCents: cents, paymentMethodId: method, paidOn: date });
      if (result.error) setError(result.error);
      else onDone();
    });
  }

  return (
    <div className="space-y-4">
      {error ? <FormMessage state={{ status: "error", message: error }} /> : null}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="receive-amount">Valor recebido (R$)</Label>
          <Input id="receive-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="receive-date">Data</Label>
          <Input id="receive-date" type="date" max={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <SimpleSelect
        id="receive-method"
        label="Forma de pagamento"
        value={method}
        onChange={setMethod}
        options={paymentMethods.map((m) => ({ value: m.id, label: m.name }))}
      />
      {feeCents ? (
        <p className="text-sm text-muted-foreground">
          Taxa de {fee.toLocaleString("pt-BR")}%: {formatCurrency(feeCents)} · líquido {formatCurrency((cents ?? 0) - feeCents)}
        </p>
      ) : null}
      <DialogFooter>
        <Button onClick={submit} disabled={pending || !method}>
          {pending ? "Registrando..." : "Confirmar recebimento"}
        </Button>
      </DialogFooter>
    </div>
  );
}

export function ReceivablesList({ receivables, paymentMethods, canOperate, canManage, showPatient = true, online, invoices }: Props) {
  const router = useRouter();
  const [receiving, setReceiving] = useState<ReceivableItem | null>(null);
  const [charging, setCharging] = useState<ReceivableItem | null>(null);
  const [viewing, setViewing] = useState<{ charge: Charge; receivable: ReceivableItem } | null>(null);
  const chargeOf = (id: string) => online?.charges.find((c) => c.receivableIds.includes(id) && (c.status === "pending" || c.status === "overdue"));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const today = todayIso();

  const run = (fn: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const result = await fn();
      if (result.error) setError(result.error);
    });

  return (
    <div className="space-y-3">
      {error ? <FormMessage state={{ status: "error", message: error }} /> : null}
      <ul className="divide-y rounded-xl border" aria-busy={pending}>
        {receivables.map((r) => {
          const pendingPayment = r.status === "open" || r.status === "overdue";
          const late = r.status === "overdue" || (r.status === "open" && r.due_date < today);
          return (
            <li key={r.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
              <div className="min-w-0 flex-1">
                {showPatient ? (
                  <Link href={`/pacientes/${r.patient_id}/financeiro`} className="font-medium hover:underline">
                    {r.patients?.full_name}
                  </Link>
                ) : null}
                <p className={showPatient ? "truncate text-sm text-muted-foreground" : "truncate text-sm font-medium"}>{r.description}</p>
                <p className="text-sm text-muted-foreground">
                  Vence {formatIsoDate(r.due_date)}
                  {r.status === "paid" && r.payment_methods?.name ? ` · ${r.payment_methods.name}` : ""}
                  {r.status === "paid" && r.fee_cents ? ` · taxa ${formatCurrency(r.fee_cents)}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-3">
                {r.in_negotiation && pendingPayment ? <Badge variant="outline">Em negociação</Badge> : null}
                <Badge variant={late ? "destructive" : r.status === "paid" ? "outline" : "secondary"}>
                  {late && r.status === "open" ? receivableStatusLabels.overdue : receivableStatusLabels[r.status]}
                </Badge>
                <span className="text-sm font-medium tabular-nums sm:w-28 sm:text-right">
                  {formatCurrency(r.status === "paid" && r.paid_amount_cents ? r.paid_amount_cents : r.amount_cents)}
                </span>
                {canOperate && pendingPayment && chargeOf(r.id) ? (
                  <Button size="sm" variant="outline" onClick={() => setViewing({ charge: chargeOf(r.id)!, receivable: r })}>
                    Ver cobrança
                  </Button>
                ) : canOperate && pendingPayment && online?.enabled ? (
                  <Button size="sm" variant="outline" onClick={() => setCharging(r)}>
                    Cobrar online
                  </Button>
                ) : null}
                {canOperate && pendingPayment ? (
                  <Button size="sm" onClick={() => setReceiving(r)}>
                    Receber
                  </Button>
                ) : null}
                {r.status === "paid" && invoices?.byReceivable[r.id] ? (
                  invoices.byReceivable[r.id]!.pdfUrl ? (
                    <a href={invoices.byReceivable[r.id]!.pdfUrl!} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>NFS-e</a>
                  ) : (
                    <Badge variant={invoices.byReceivable[r.id]!.status === "error" ? "destructive" : "secondary"}>{invoices.byReceivable[r.id]!.status === "error" ? "NFS-e com erro" : "NFS-e em emissão"}</Badge>
                  )
                ) : null}
                {r.status === "paid" ? (
                  <a href={`/financeiro/recibo/${r.id}`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
                    <FileDown aria-hidden />
                    Recibo
                  </a>
                ) : null}
                {(canManage && (pendingPayment || r.status === "paid")) || (canOperate && (pendingPayment || (r.status === "paid" && invoices?.enabled))) ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Mais ações: ${r.description}`} />}>
                      <MoreHorizontal />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-44">
                      {pendingPayment && canOperate ? (
                        <DropdownMenuItem className="pointer-coarse:min-h-11" onClick={() => run(() => setNegotiation(r.id, !r.in_negotiation))}>
                          {r.in_negotiation ? "Tirar de negociação" : "Marcar em negociação"}
                        </DropdownMenuItem>
                      ) : null}
                      {r.status === "paid" && invoices?.enabled && (!invoices.byReceivable[r.id] || invoices.byReceivable[r.id]!.status === "error") ? (
                        <DropdownMenuItem className="pointer-coarse:min-h-11" onClick={() => run(() => issueInvoiceAction(r.id))}>
                          Emitir NFS-e
                        </DropdownMenuItem>
                      ) : null}
                      {r.status === "paid" && canManage ? (
                        <DropdownMenuItem className="pointer-coarse:min-h-11" onClick={() => run(() => reversePayment(r.id))}>
                          Estornar pagamento
                        </DropdownMenuItem>
                      ) : null}
                      {pendingPayment && canManage ? (
                        <DropdownMenuItem variant="destructive" className="pointer-coarse:min-h-11" onClick={() => run(() => cancelReceivable(r.id))}>
                          Cancelar parcela
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <Dialog open={charging !== null} onOpenChange={(o) => { if (!o) { setCharging(null); router.refresh(); } }}>
        <DialogContent className="sm:max-w-lg">
          {charging ? (
            <>
              <DialogHeader>
                <DialogTitle>Cobrar online</DialogTitle>
                <DialogDescription>{charging.patients?.full_name}</DialogDescription>
              </DialogHeader>
              <ChargeForm
                receivables={receivables.filter((x) => x.patient_id === charging.patient_id && (x.status === "open" || x.status === "overdue") && !chargeOf(x.id))}
                preselected={[charging.id]}
                patientName={charging.patients?.full_name ?? ""}
                phone={charging.patients?.whatsapp ?? charging.patients?.phone ?? null}
                clinicName={online?.clinicName ?? ""}
              />
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={viewing !== null} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="sm:max-w-lg">
          {viewing ? (
            <>
              <DialogHeader>
                <DialogTitle>Cobrança enviada</DialogTitle>
                <DialogDescription>{viewing.receivable.patients?.full_name}</DialogDescription>
              </DialogHeader>
              <ChargeView
                charge={viewing.charge}
                patientName={viewing.receivable.patients?.full_name ?? ""}
                phone={viewing.receivable.patients?.whatsapp ?? viewing.receivable.patients?.phone ?? null}
                clinicName={online?.clinicName ?? ""}
                onCanceled={() => {
                  setViewing(null);
                  router.refresh();
                }}
              />
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={receiving !== null} onOpenChange={(o) => !o && setReceiving(null)}>
        <DialogContent className="sm:max-w-md">
          {receiving ? (
            <>
              <DialogHeader>
                <DialogTitle>Receber pagamento</DialogTitle>
                <DialogDescription>
                  {receiving.patients?.full_name} · {receiving.description} · {formatCurrency(receiving.amount_cents)}
                </DialogDescription>
              </DialogHeader>
              <ReceiveForm receivable={receiving} paymentMethods={paymentMethods} onDone={() => setReceiving(null)} />
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
