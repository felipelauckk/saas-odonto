"use client";

import { MapPin, Pencil, Plus } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { FormDialog } from "@/components/forms/form-dialog";
import { FormField } from "@/components/forms/form-field";
import { SwitchField } from "@/components/forms/switch-field";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/action-state";
import { formatPhone } from "@/lib/documents";

import { saveUnit } from "../actions/units";
import { StatusBadge } from "./status-badge";

type Address = {
  cep?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
};

export type UnitItem = { id: string; name: string; phone: string | null; address: unknown; active: boolean };

function asAddress(value: unknown): Address {
  return value && typeof value === "object" ? (value as Address) : {};
}

function addressLine(a: Address) {
  const street = [a.street, a.number].filter(Boolean).join(", ");
  const city = [a.city, a.state].filter(Boolean).join(" - ");
  return [street, a.district, city].filter(Boolean).join(" · ");
}

function UnitFields({ unit, state }: { unit?: UnitItem; state: ActionState }) {
  const a = asAddress(unit?.address);
  const v = state.status === "error" ? state.values : undefined;
  const e = state.fieldErrors;
  const val = (key: keyof Address | "name" | "phone", fallback: string | null | undefined) => v?.[key] ?? fallback ?? "";

  return (
    <>
      {unit ? <input type="hidden" name="id" value={unit.id} /> : null}
      <FormField label="Nome" name="name" required placeholder="Ex.: Unidade Centro" defaultValue={val("name", unit?.name)} errors={e?.name} />
      <FormField
        label="Telefone"
        name="phone"
        type="tel"
        inputMode="tel"
        defaultValue={val("phone", unit?.phone ? formatPhone(unit.phone) : "")}
        errors={e?.phone}
      />
      <div className="grid gap-4 sm:grid-cols-6">
        <FormField label="CEP" name="cep" inputMode="numeric" defaultValue={val("cep", a.cep)} errors={e?.cep} containerClassName="sm:col-span-2" />
        <FormField label="Rua" name="street" defaultValue={val("street", a.street)} errors={e?.street} containerClassName="sm:col-span-4" />
        <FormField label="Número" name="number" defaultValue={val("number", a.number)} errors={e?.number} containerClassName="sm:col-span-2" />
        <FormField label="Complemento" name="complement" defaultValue={val("complement", a.complement)} errors={e?.complement} containerClassName="sm:col-span-4" />
        <FormField label="Bairro" name="district" defaultValue={val("district", a.district)} errors={e?.district} containerClassName="sm:col-span-3" />
        <FormField label="Cidade" name="city" defaultValue={val("city", a.city)} errors={e?.city} containerClassName="sm:col-span-2" />
        <FormField label="UF" name="state" maxLength={2} defaultValue={val("state", a.state)} errors={e?.state} containerClassName="sm:col-span-1" />
      </div>
      <SwitchField
        name="active"
        label="Unidade ativa"
        description="Unidades inativas somem da agenda e do seletor."
        defaultChecked={v ? v.active === "on" : (unit?.active ?? true)}
      />
    </>
  );
}

export function NewUnitButton() {
  return (
    <FormDialog
      title="Nova unidade"
      action={saveUnit}
      submitLabel="Criar unidade"
      trigger={
        <Button>
          <Plus aria-hidden />
          Nova unidade
        </Button>
      }
    >
      {(state) => <UnitFields state={state} />}
    </FormDialog>
  );
}

export function UnitsList({ units }: { units: UnitItem[] }) {
  if (!units.length) {
    return <EmptyState icon={MapPin} title="Nenhuma unidade" description="Crie a primeira unidade da clínica." />;
  }

  return (
    <ul className="divide-y rounded-xl border">
      {units.map((unit) => {
        const line = addressLine(asAddress(unit.address));
        return (
          <li key={unit.id} className="flex items-center gap-4 px-4 py-3 sm:px-5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{unit.name}</span>
                <StatusBadge active={unit.active} />
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {[line || "Endereço não informado", unit.phone ? formatPhone(unit.phone) : null].filter(Boolean).join(" · ")}
              </p>
            </div>
            <FormDialog
              title="Editar unidade"
              action={saveUnit}
              trigger={
                <Button variant="ghost" size="icon" aria-label={`Editar ${unit.name}`}>
                  <Pencil />
                </Button>
              }
            >
              {(state) => <UnitFields unit={unit} state={state} />}
            </FormDialog>
          </li>
        );
      })}
    </ul>
  );
}
