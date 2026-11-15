"use client";

import { useState, useTransition } from "react";

import { Input } from "@/components/ui/input";
import { centsToInput, parseBRLToCents } from "@/lib/money";

import { setLabCost } from "../actions";

/** Custo de laboratório do item (só a gestão). Salva ao sair do campo. */
export function LabCostInput({ itemId, initialCents, label }: { itemId: string; initialCents: number; label: string }) {
  const [value, setValue] = useState(centsToInput(initialCents));
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      Lab.
      <Input
        aria-label={`Custo de laboratório de ${label}`}
        inputMode="decimal"
        value={value}
        disabled={pending}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          const cents = parseBRLToCents(value || "0");
          if (cents === null) return setStatus("valor inválido");
          if (cents === initialCents) return;
          startTransition(async () => {
            const r = await setLabCost(itemId, cents);
            setStatus(r.error ? r.error : "salvo");
          });
        }}
        className="h-7 w-24 text-right text-xs tabular-nums"
      />
      {status ? <span role="status">{status}</span> : null}
    </span>
  );
}
