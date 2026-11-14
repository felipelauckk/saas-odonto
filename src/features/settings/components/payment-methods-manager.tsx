"use client";

import { CreditCard, Pencil, Plus } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { FormDialog } from "@/components/forms/form-dialog";
import { FormField } from "@/components/forms/form-field";
import { SwitchField } from "@/components/forms/switch-field";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/action-state";

import { savePaymentMethod } from "../actions/payment-methods";
import { StatusBadge } from "./status-badge";

export type PaymentMethodItem = {
  id: string;
  name: string;
  fee_percent: number;
  days_to_receive: number;
  active: boolean;
};

const percent = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

function PaymentMethodFields({ method, state }: { method?: PaymentMethodItem; state: ActionState }) {
  const v = state.status === "error" ? state.values : undefined;
  const e = state.fieldErrors;
  return (
    <>
      {method ? <input type="hidden" name="id" value={method.id} /> : null}
      <FormField label="Nome" name="name" required defaultValue={v?.name ?? method?.name ?? ""} errors={e?.name} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Taxa (%)"
          name="feePercent"
          inputMode="decimal"
          hint="Cobrada pela maquininha ou banco."
          defaultValue={v?.feePercent ?? (method ? percent.format(method.fee_percent) : "0")}
          errors={e?.feePercent}
        />
        <FormField
          label="Prazo para receber (dias)"
          name="daysToReceive"
          inputMode="numeric"
          defaultValue={v?.daysToReceive ?? String(method?.days_to_receive ?? 0)}
          errors={e?.daysToReceive}
        />
      </div>
      <SwitchField
        name="active"
        label="Forma de pagamento ativa"
        defaultChecked={v ? v.active === "on" : (method?.active ?? true)}
      />
    </>
  );
}

export function NewPaymentMethodButton() {
  return (
    <FormDialog
      title="Nova forma de pagamento"
      action={savePaymentMethod}
      submitLabel="Criar"
      trigger={
        <Button>
          <Plus aria-hidden />
          Nova forma
        </Button>
      }
    >
      {(state) => <PaymentMethodFields state={state} />}
    </FormDialog>
  );
}

function describe(m: PaymentMethodItem) {
  const fee = m.fee_percent > 0 ? `Taxa de ${percent.format(m.fee_percent)}%` : "Sem taxa";
  const days =
    m.days_to_receive === 0 ? "recebe na hora" : `recebe em ${m.days_to_receive} ${m.days_to_receive === 1 ? "dia" : "dias"}`;
  return `${fee} · ${days}`;
}

export function PaymentMethodsList({ methods }: { methods: PaymentMethodItem[] }) {
  if (!methods.length) {
    return <EmptyState icon={CreditCard} title="Nenhuma forma de pagamento" description="Cadastre como a clínica recebe." />;
  }
  return (
    <ul className="divide-y rounded-xl border">
      {methods.map((m) => (
        <li key={m.id} className="flex items-center gap-4 px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{m.name}</span>
              {!m.active ? <StatusBadge active={false} /> : null}
            </div>
            <p className="text-sm text-muted-foreground">{describe(m)}</p>
          </div>
          <FormDialog
            title="Editar forma de pagamento"
            action={savePaymentMethod}
            trigger={
              <Button variant="ghost" size="icon" aria-label={`Editar ${m.name}`}>
                <Pencil />
              </Button>
            }
          >
            {(state) => <PaymentMethodFields method={m} state={state} />}
          </FormDialog>
        </li>
      ))}
    </ul>
  );
}
