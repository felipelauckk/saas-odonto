"use client";

import { useState, useTransition } from "react";

import { FormMessage } from "@/components/forms/form-message";
import { SimpleSelect } from "@/components/forms/simple-select";
import { Button } from "@/components/ui/button";

import { updateClinicSubscription } from "../actions";

type Props = { clinicId: string; planId: string | null; plans: { id: string; name: string }[] };

export function ClinicAdminActions({ clinicId, planId, plans }: Props) {
  const [plan, setPlan] = useState(planId ?? "none");
  const [message, setMessage] = useState<{ status: "error" | "success"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: Parameters<typeof updateClinicSubscription>[0]["action"], extra: { planId?: string | null } = {}) =>
    startTransition(async () => {
      const result = await updateClinicSubscription({ clinicId, action, ...extra });
      setMessage(result.error ? { status: "error", message: result.error } : { status: "success", message: "Atualizado." });
    });

  return (
    <div className="space-y-4">
      {message ? <FormMessage state={message} /> : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={pending} onClick={() => run("extend_trial_7")}>Estender teste +7 dias</Button>
        <Button variant="outline" disabled={pending} onClick={() => run("extend_trial_14")}>Estender teste +14 dias</Button>
        <Button variant="outline" disabled={pending} onClick={() => run("set_active")}>Marcar como ativa</Button>
        <Button variant="ghost" disabled={pending} onClick={() => run("set_canceled")}>Marcar como cancelada</Button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <SimpleSelect
          id="admin-plan"
          label="Plano"
          value={plan}
          onChange={setPlan}
          options={[{ value: "none", label: "Sem plano" }, ...plans.map((p) => ({ value: p.id, label: p.name }))]}
          className="w-56 data-[size=default]:h-9 pointer-coarse:data-[size=default]:h-11"
        />
        <Button disabled={pending} onClick={() => run("set_plan", { planId: plan === "none" ? null : plan })}>
          Trocar plano
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Ajustes manuais não alteram a cobrança no Asaas.</p>
    </div>
  );
}
