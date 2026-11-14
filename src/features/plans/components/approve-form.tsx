"use client";

import { useMemo, useState, useTransition } from "react";

import { FormMessage } from "@/components/forms/form-message";
import { SimpleSelect } from "@/components/forms/simple-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatIsoDate, todayIso } from "@/lib/dates";
import { formatCurrency } from "@/lib/format";
import { splitInstallments } from "@/lib/installments";
import { parseBRLToCents } from "@/lib/money";

import { approvePlan } from "../actions";

type Props = {
  planId: string;
  items: { id: string; description: string; tooth: number | null; price_cents: number }[];
  paymentMethods: { id: string; name: string }[];
  onDone: () => void;
  onCancel: () => void;
};

export function ApproveForm({ planId, items, paymentMethods, onDone, onCancel }: Props) {
  const [selected, setSelected] = useState(() => items.map((i) => i.id));
  const [discount, setDiscount] = useState("0,00");
  const [installments, setInstallments] = useState(1);
  const [firstDue, setFirstDue] = useState(todayIso());
  const [method, setMethod] = useState(paymentMethods[0]?.id ?? "none");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const approvedTotal = items.filter((i) => selected.includes(i.id)).reduce((s, i) => s + i.price_cents, 0);
  const discountCents = parseBRLToCents(discount);
  const net = approvedTotal - (discountCents ?? 0);
  const schedule = useMemo(() => splitInstallments(Math.max(net, 0), installments, firstDue), [net, installments, firstDue]);

  function submit() {
    if (discountCents === null || discountCents > approvedTotal) {
      setError("Desconto inválido ou maior que o valor aprovado.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await approvePlan({
        planId,
        itemIds: selected,
        discountCents,
        installments,
        firstDueDate: firstDue,
        paymentMethodId: method === "none" ? null : method,
      });
      if (result.error) setError(result.error);
      else onDone();
    });
  }

  return (
    <div className="space-y-4">
      {error ? <FormMessage state={{ status: "error", message: error }} /> : null}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Itens aprovados pelo paciente</legend>
        <ul className="divide-y rounded-lg border">
          {items.map((item) => (
            <li key={item.id}>
              <Label className="flex items-center gap-3 px-3 py-2 font-normal pointer-coarse:min-h-11">
                <Checkbox
                  checked={selected.includes(item.id)}
                  onCheckedChange={(c) => setSelected((list) => (c === true ? [...list, item.id] : list.filter((id) => id !== item.id)))}
                />
                <span className="flex-1">
                  {item.description}
                  {item.tooth ? <span className="text-muted-foreground"> · dente {item.tooth}</span> : null}
                </span>
                <span className="tabular-nums">{formatCurrency(item.price_cents)}</span>
              </Label>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">Itens desmarcados ficam como recusados.</p>
      </fieldset>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="approve-discount">Desconto (R$)</Label>
          <Input id="approve-discount" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </div>
        <SimpleSelect
          id="approve-installments"
          label="Parcelas"
          value={String(installments)}
          onChange={(v) => setInstallments(Number(v))}
          options={Array.from({ length: 24 }, (_, i) => ({ value: String(i + 1), label: i === 0 ? "À vista" : `${i + 1}x` }))}
        />
        <div className="space-y-1.5">
          <Label htmlFor="approve-first-due">{installments > 1 ? "1º vencimento" : "Vencimento"}</Label>
          <Input id="approve-first-due" type="date" value={firstDue} onChange={(e) => setFirstDue(e.target.value)} />
        </div>
        <SimpleSelect
          id="approve-method"
          label="Forma de pagamento"
          value={method}
          onChange={setMethod}
          options={[{ value: "none", label: "A definir" }, ...paymentMethods.map((m) => ({ value: m.id, label: m.name }))]}
        />
      </div>

      <div className="rounded-lg bg-muted/40 p-3 text-sm">
        <p className="flex justify-between font-medium">
          <span>Total a receber</span>
          <span className="tabular-nums">{formatCurrency(Math.max(net, 0))}</span>
        </p>
        {schedule.length > 1 ? (
          <ul className="mt-2 space-y-0.5 text-muted-foreground">
            {schedule.map((p) => (
              <li key={p.number} className="flex justify-between tabular-nums">
                <span>
                  {p.number}ª · {formatIsoDate(p.dueDate)}
                </span>
                <span>{formatCurrency(p.amountCents)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" onClick={submit} disabled={pending || !selected.length}>
          {pending ? "Aprovando..." : "Aprovar e gerar parcelas"}
        </Button>
      </div>
    </div>
  );
}
