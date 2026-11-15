"use client";

import { useState, useTransition } from "react";

import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";

import { closeCommissionMonth } from "../actions";

export function CloseMonthButton({ professionalId, month, label }: { professionalId: string; month: string; label: string }) {
  const [msg, setMsg] = useState<{ status: "error" | "success"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-2">
      {msg ? <FormMessage state={msg} /> : null}
      <Button
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`Fechar ${label}? O extrato fica congelado e o repasse vai para contas a pagar.`)) return;
          startTransition(async () => {
            const r = await closeCommissionMonth(professionalId, month);
            setMsg(r.error ? { status: "error", message: r.error } : { status: "success", message: r.message ?? "Fechado." });
          });
        }}
      >
        {pending ? "Fechando..." : "Fechar mês"}
      </Button>
    </div>
  );
}
