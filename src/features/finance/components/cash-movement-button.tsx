"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { cn } from "cn";

import { FormMessage } from "@/components/forms/form-message";
import { SimpleSelect } from "@/components/forms/simple-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseBRLToCents } from "@/lib/money";

import { addCashMovement } from "../actions";

export function CashMovementButton({ paymentMethods }: { paymentMethods: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"in" | "out">("out");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [method, setMethod] = useState(paymentMethods[0]?.id ?? "none");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    const cents = parseBRLToCents(amount);
    if (!cents) return setError("Valor inválido.");
    startTransition(async () => {
      const result = await addCashMovement({ type, amountCents: cents, description, paymentMethodId: method === "none" ? null : method });
      if (result.error) setError(result.error);
      else {
        setOpen(false);
        setAmount("");
        setDescription("");
      }
    });
  }

  const segment = (active: boolean) =>
    cn("h-8 flex-1 rounded-md px-3 text-sm font-medium pointer-coarse:h-11", active ? "bg-background shadow-xs" : "text-muted-foreground");

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); setError(null); }}>
      <DialogTrigger render={<Button />}>
        <Plus aria-hidden />
        Lançar no caixa
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lançamento no caixa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {error ? <FormMessage state={{ status: "error", message: error }} /> : null}
          <div className="flex rounded-lg bg-muted p-1" role="group" aria-label="Tipo">
            <button type="button" className={segment(type === "out")} aria-pressed={type === "out"} onClick={() => setType("out")}>
              Saída
            </button>
            <button type="button" className={segment(type === "in")} aria-pressed={type === "in"} onClick={() => setType("in")}>
              Entrada
            </button>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cash-description">Descrição</Label>
            <Input id="cash-description" placeholder={type === "out" ? "Ex.: compra de material" : "Ex.: troco inicial"} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cash-amount">Valor (R$)</Label>
              <Input id="cash-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <SimpleSelect
              id="cash-method"
              label="Forma"
              value={method}
              onChange={setMethod}
              options={[{ value: "none", label: "Não informar" }, ...paymentMethods.map((m) => ({ value: m.id, label: m.name }))]}
            />
          </div>
          <p className="text-xs text-muted-foreground">Lançamentos não podem ser editados. Para corrigir, lance o contrário.</p>
          <DialogFooter>
            <Button onClick={submit} disabled={pending}>
              {pending ? "Salvando..." : "Lançar"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
