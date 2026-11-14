"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { cn } from "cn";

import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";

import { cancelClinicSubscription, openInvoice, subscribeToPlan } from "../actions";

type Plan = { id: string; name: string; price_cents: number; max_units: number | null; max_professionals: number | null };

type Props = {
  plans: Plan[];
  currentPlanId: string | null;
  status: string;
  hasSubscription: boolean;
  isOwner: boolean;
};

export function PlanPicker({ plans, currentPlanId, status, hasSubscription, isOwner }: Props) {
  const [message, setMessage] = useState<{ status: "error" | "success"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const subscribed = hasSubscription && status !== "canceled";

  const run = (fn: () => Promise<{ error?: string; url?: string; message?: string }>) =>
    startTransition(async () => {
      setMessage(null);
      const result = await fn();
      if (result.error) setMessage({ status: "error", message: result.error });
      else if (result.url) window.location.href = result.url;
      else if (result.message) setMessage({ status: "success", message: result.message });
    });

  return (
    <div className="space-y-4">
      {message ? <FormMessage state={message} /> : null}
      <ul className="grid gap-3 md:grid-cols-3">
        {plans.map((plan) => {
          const current = plan.id === currentPlanId && subscribed;
          return (
            <li key={plan.id} className={cn("flex flex-col gap-4 rounded-xl border p-5", current && "border-primary ring-1 ring-primary")}>
              <div className="space-y-1">
                <p className="font-medium">{plan.name}</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {formatCurrency(plan.price_cents)}
                  <span className="text-sm font-normal text-muted-foreground">/mês</span>
                </p>
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <Check className="mt-0.5 size-4 text-primary" aria-hidden />
                  {plan.max_units ? `Até ${plan.max_units} ${plan.max_units === 1 ? "unidade" : "unidades"}` : "Unidades ilimitadas"}
                </li>
                <li className="flex gap-2">
                  <Check className="mt-0.5 size-4 text-primary" aria-hidden />
                  {plan.max_professionals ? `Até ${plan.max_professionals} profissionais` : "Profissionais ilimitados"}
                </li>
              </ul>
              {isOwner ? (
                <Button className="mt-auto" variant={current ? "outline" : "default"} disabled={pending || current} onClick={() => run(() => subscribeToPlan(plan.id))}>
                  {current ? "Plano atual" : subscribed ? "Mudar para este plano" : "Assinar"}
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {isOwner && subscribed ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={pending} onClick={() => run(openInvoice)}>
            Pagar fatura em aberto
          </Button>
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => {
              if (window.confirm("Cancelar a assinatura? A clínica passa a modo somente leitura; os dados continuam guardados.")) run(cancelClinicSubscription);
            }}
          >
            Cancelar assinatura
          </Button>
        </div>
      ) : null}
      {!isOwner ? <p className="text-sm text-muted-foreground">Só o proprietário da clínica assina ou muda de plano.</p> : null}
    </div>
  );
}
