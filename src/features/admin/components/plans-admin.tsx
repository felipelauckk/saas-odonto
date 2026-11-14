"use client";

import { Pencil, Plus } from "lucide-react";

import { FormDialog } from "@/components/forms/form-dialog";
import { FormField } from "@/components/forms/form-field";
import { SwitchField } from "@/components/forms/switch-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/action-state";
import { formatCurrency } from "@/lib/format";
import { centsToInput } from "@/lib/money";

import { savePlan } from "../actions";

type Plan = { id: string; name: string; price_cents: number; max_units: number | null; max_professionals: number | null; active: boolean };

function Fields({ plan, state }: { plan?: Plan; state: ActionState }) {
  const v = state.status === "error" ? state.values : undefined;
  const e = state.fieldErrors;
  return (
    <>
      {plan ? <input type="hidden" name="id" value={plan.id} /> : null}
      <FormField label="Nome" name="name" defaultValue={v?.name ?? plan?.name ?? ""} errors={e?.name} />
      <FormField label="Preço mensal (R$)" name="price" inputMode="decimal" defaultValue={v?.price ?? (plan ? centsToInput(plan.price_cents) : "")} errors={e?.price} />
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Máx. de unidades" name="maxUnits" inputMode="numeric" hint="Vazio = ilimitado" defaultValue={v?.maxUnits ?? plan?.max_units?.toString() ?? ""} errors={e?.maxUnits} />
        <FormField label="Máx. de profissionais" name="maxProfessionals" inputMode="numeric" hint="Vazio = ilimitado" defaultValue={v?.maxProfessionals ?? plan?.max_professionals?.toString() ?? ""} errors={e?.maxProfessionals} />
      </div>
      <SwitchField name="active" label="Disponível para assinar" defaultChecked={v ? v.active === "on" : (plan?.active ?? true)} />
    </>
  );
}

export function PlansAdmin({ plans }: { plans: Plan[] }) {
  return (
    <div className="space-y-4">
      <FormDialog title="Novo plano" action={savePlan} submitLabel="Criar plano" trigger={<Button><Plus aria-hidden />Novo plano</Button>}>
        {(state) => <Fields state={state} />}
      </FormDialog>
      {plans.length ? (
        <ul className="divide-y rounded-xl border">
          {plans.map((p) => (
            <li key={p.id} className="flex items-center gap-4 px-4 py-3 sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-medium">
                  {p.name} {!p.active ? <Badge variant="secondary">Inativo</Badge> : null}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(p.price_cents)}/mês · {p.max_units === null ? "unidades ilimitadas" : `${p.max_units} ${p.max_units === 1 ? "unidade" : "unidades"}`} ·{" "}
                  {p.max_professionals === null ? "profissionais ilimitados" : `${p.max_professionals} ${p.max_professionals === 1 ? "profissional" : "profissionais"}`}
                </p>
              </div>
              <FormDialog title="Editar plano" action={savePlan} trigger={<Button variant="ghost" size="icon" aria-label={`Editar ${p.name}`}><Pencil /></Button>}>
                {(state) => <Fields plan={p} state={state} />}
              </FormDialog>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed px-6 py-8 text-center text-sm text-muted-foreground">Nenhum plano. As clínicas só conseguem assinar depois que houver pelo menos um.</p>
      )}
    </div>
  );
}
