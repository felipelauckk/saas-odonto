"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal, Paperclip } from "lucide-react";

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

import { cancelPayable, payPayable } from "../actions";

type Row = {
  id: string;
  description: string;
  amount_cents: number;
  due_date: string;
  status: "open" | "paid" | "overdue" | "canceled";
  paid_amount_cents: number | null;
  recurring: boolean;
  group_id: string | null;
  attachment_path: string | null;
  suppliers: { name: string } | null;
  finance_categories: { name: string } | null;
};

const statusLabel = { open: "A pagar", overdue: "Vencida", paid: "Paga", canceled: "Cancelada" } as const;

export function PayablesList({ rows, paymentMethods }: { rows: Row[]; paymentMethods: { id: string; name: string }[] }) {
  const [paying, setPaying] = useState<Row | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIso());
  const [method, setMethod] = useState(paymentMethods[0]?.id ?? "none");
  const [message, setMessage] = useState<{ status: "error" | "success"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ error?: string; message?: string }>, after?: () => void) =>
    startTransition(async () => {
      const r = await fn();
      if (r.error) setMessage({ status: "error", message: r.error });
      else {
        setMessage(r.message ? { status: "success", message: r.message } : null);
        after?.();
      }
    });

  return (
    <div className="space-y-3">
      {message ? <FormMessage state={message} /> : null}
      <ul className="divide-y rounded-xl border" aria-busy={pending}>
        {rows.map((r) => (
          <li key={r.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{r.description}</p>
              <p className="text-sm text-muted-foreground">
                Vence {formatIsoDate(r.due_date)} · {r.finance_categories?.name}
                {r.suppliers?.name ? ` · ${r.suppliers.name}` : ""}
                {r.recurring ? " · mensal" : ""}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={r.status === "overdue" ? "destructive" : r.status === "paid" ? "outline" : "secondary"}>{statusLabel[r.status]}</Badge>
              <span className="w-28 text-right text-sm font-medium tabular-nums">{formatCurrency(r.paid_amount_cents ?? r.amount_cents)}</span>
              {r.attachment_path ? (
                <a href={`/financeiro/anexo/${r.id}`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label={`Comprovante de ${r.description}`}>
                  <Paperclip />
                </a>
              ) : null}
              {r.status === "open" || r.status === "overdue" ? (
                <>
                  <Button size="sm" onClick={() => { setPaying(r); setAmount(centsToInput(r.amount_cents)); setMessage(null); }}>
                    Pagar
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Mais ações: ${r.description}`} />}>
                      <MoreHorizontal />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-52">
                      <DropdownMenuItem className="pointer-coarse:min-h-11" onClick={() => run(() => cancelPayable(r.id, false))}>Cancelar esta</DropdownMenuItem>
                      {r.group_id ? (
                        <DropdownMenuItem variant="destructive" className="pointer-coarse:min-h-11" onClick={() => run(() => cancelPayable(r.id, true))}>
                          Cancelar esta e as próximas
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <Dialog open={paying !== null} onOpenChange={(o) => !o && setPaying(null)}>
        <DialogContent className="sm:max-w-md">
          {paying ? (
            <>
              <DialogHeader>
                <DialogTitle>Pagar conta</DialogTitle>
                <DialogDescription>{paying.description} · a saída entra no caixa da unidade.</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="paid-amount">Valor pago (R$)</Label>
                  <Input id="paid-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="paid-date">Data</Label>
                  <Input id="paid-date" type="date" max={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
              </div>
              <SimpleSelect id="paid-method" label="Forma de pagamento" value={method} onChange={setMethod} options={[{ value: "none", label: "Não informar" }, ...paymentMethods.map((m) => ({ value: m.id, label: m.name }))]} />
              <DialogFooter>
                <Button
                  disabled={pending}
                  onClick={() => {
                    const cents = parseBRLToCents(amount);
                    if (!cents) return setMessage({ status: "error", message: "Valor inválido." });
                    run(() => payPayable({ payableId: paying.id, paidAmountCents: cents, paymentMethodId: method === "none" ? null : method, paidOn: date }), () => setPaying(null));
                  }}
                >
                  {pending ? "Pagando..." : "Confirmar pagamento"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
