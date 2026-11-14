"use client";

import { Armchair, Pencil, Plus } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { FormDialog } from "@/components/forms/form-dialog";
import { FormField } from "@/components/forms/form-field";
import { SelectField } from "@/components/forms/select-field";
import { SwitchField } from "@/components/forms/switch-field";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/action-state";

import { saveChair } from "../actions/chairs";
import { StatusBadge } from "./status-badge";

type Unit = { id: string; name: string; active: boolean };
export type ChairItem = { id: string; name: string; active: boolean; unit_id: string };

function ChairFields({ chair, units, state, unitId }: { chair?: ChairItem; units: Unit[]; state: ActionState; unitId?: string }) {
  const v = state.status === "error" ? state.values : undefined;
  return (
    <>
      {chair ? (
        <>
          <input type="hidden" name="id" value={chair.id} />
          <input type="hidden" name="unitId" value={chair.unit_id} />
        </>
      ) : units.length > 1 ? (
        <SelectField
          name="unitId"
          label="Unidade"
          options={units.filter((u) => u.active).map((u) => ({ value: u.id, label: u.name }))}
          defaultValue={v?.unitId ?? unitId}
          errors={state.fieldErrors?.unitId}
        />
      ) : (
        <input type="hidden" name="unitId" value={units[0]?.id ?? ""} />
      )}
      <FormField
        label="Nome"
        name="name"
        required
        placeholder="Ex.: Cadeira 1"
        defaultValue={v?.name ?? chair?.name ?? ""}
        errors={state.fieldErrors?.name}
      />
      <SwitchField
        name="active"
        label="Cadeira ativa"
        description="Cadeiras inativas não aparecem na agenda."
        defaultChecked={v ? v.active === "on" : (chair?.active ?? true)}
      />
    </>
  );
}

export function NewChairButton({ units, unitId }: { units: Unit[]; unitId?: string }) {
  return (
    <FormDialog
      title="Nova cadeira"
      action={saveChair}
      submitLabel="Criar cadeira"
      trigger={
        <Button>
          <Plus aria-hidden />
          Nova cadeira
        </Button>
      }
    >
      {(state) => <ChairFields units={units} state={state} unitId={unitId} />}
    </FormDialog>
  );
}

export function ChairsList({ chairs, units }: { chairs: ChairItem[]; units: Unit[] }) {
  if (!chairs.length) {
    return (
      <EmptyState
        icon={Armchair}
        title="Nenhuma cadeira cadastrada"
        description="Cadastre as cadeiras para organizar a agenda por cadeira."
      />
    );
  }

  const groups = units
    .map((unit) => ({ unit, chairs: chairs.filter((c) => c.unit_id === unit.id) }))
    .filter((g) => g.chairs.length);
  const showUnit = units.length > 1;

  return (
    <div className="space-y-6">
      {groups.map(({ unit, chairs: unitChairs }) => (
        <section key={unit.id} className="space-y-2" aria-label={unit.name}>
          {showUnit ? <h2 className="text-sm font-medium text-muted-foreground">{unit.name}</h2> : null}
          <ul className="divide-y rounded-xl border">
            {unitChairs.map((chair) => (
              <li key={chair.id} className="flex items-center gap-4 px-4 py-3 sm:px-5">
                <span className="flex flex-1 flex-wrap items-center gap-2">
                  <span className="font-medium">{chair.name}</span>
                  <StatusBadge active={chair.active} />
                </span>
                <FormDialog
                  title="Editar cadeira"
                  action={saveChair}
                  trigger={
                    <Button variant="ghost" size="icon" aria-label={`Editar ${chair.name}`}>
                      <Pencil />
                    </Button>
                  }
                >
                  {(state) => <ChairFields chair={chair} units={units} state={state} />}
                </FormDialog>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
