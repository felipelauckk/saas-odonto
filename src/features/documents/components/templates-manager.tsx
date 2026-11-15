"use client";

import { Pencil, Plus } from "lucide-react";

import { FormDialog } from "@/components/forms/form-dialog";
import { FormField } from "@/components/forms/form-field";
import { SelectField } from "@/components/forms/select-field";
import { SwitchField } from "@/components/forms/switch-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState } from "@/lib/action-state";

import { saveDocumentTemplate, saveMedication } from "../actions";
import { documentKindLabels, documentKinds, type DocumentKind } from "../labels";
import { VARIABLES } from "../variables";

type Template = { id: string; kind: DocumentKind; name: string; body: string; procedure_id: string | null; active: boolean };
type Medication = { id: string; name: string; presentation: string | null; default_dosage: string | null; default_quantity: string | null; special_control: boolean; active: boolean };

function TemplateFields({ template, procedures, state }: { template?: Template; procedures: { id: string; name: string }[]; state: ActionState }) {
  const v = state.status === "error" ? state.values : undefined;
  return (
    <>
      {template ? <input type="hidden" name="id" value={template.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField name="kind" label="Tipo" options={documentKinds.map((k) => ({ value: k, label: documentKindLabels[k] }))} defaultValue={v?.kind ?? template?.kind ?? "other"} />
        <FormField label="Nome" name="name" defaultValue={v?.name ?? template?.name ?? ""} errors={state.fieldErrors?.name} />
      </div>
      <SelectField
        name="procedureId"
        label="Procedimento (termos específicos)"
        options={[{ value: "none", label: "Nenhum" }, ...procedures.map((p) => ({ value: p.id, label: p.name }))]}
        defaultValue={v?.procedureId ?? template?.procedure_id ?? "none"}
      />
      <div className="space-y-1.5">
        <Label htmlFor="template-body">Texto</Label>
        <Textarea id="template-body" name="body" rows={12} className="font-mono text-sm" defaultValue={v?.body ?? template?.body ?? ""} />
        {state.fieldErrors?.body?.[0] ? <p className="text-sm text-destructive">{state.fieldErrors.body[0]}</p> : null}
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">Variáveis disponíveis</summary>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {VARIABLES.map((variable) => (
              <li key={variable.key}>
                <code>{`{{${variable.key}}}`}</code> — {variable.label}
              </li>
            ))}
          </ul>
        </details>
      </div>
      <SwitchField name="active" label="Modelo ativo" defaultChecked={v ? v.active === "on" : (template?.active ?? true)} />
    </>
  );
}

export function TemplatesManager({ templates, procedures }: { templates: Template[]; procedures: { id: string; name: string }[] }) {
  return (
    <div className="space-y-3">
      <FormDialog title="Novo modelo" action={saveDocumentTemplate} submitLabel="Criar modelo" trigger={<Button variant="outline"><Plus aria-hidden />Novo modelo</Button>}>
        {(state) => <TemplateFields procedures={procedures} state={state} />}
      </FormDialog>
      <ul className="divide-y rounded-xl border">
        {templates.map((t) => (
          <li key={t.id} className="flex items-center gap-4 px-4 py-3 sm:px-5">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 font-medium">
                {t.name} {!t.active ? <Badge variant="secondary">Inativo</Badge> : null}
              </p>
              <p className="text-sm text-muted-foreground">{documentKindLabels[t.kind]}</p>
            </div>
            <FormDialog title="Editar modelo" action={saveDocumentTemplate} trigger={<Button variant="ghost" size="icon" aria-label={`Editar ${t.name}`}><Pencil /></Button>}>
              {(state) => <TemplateFields template={t} procedures={procedures} state={state} />}
            </FormDialog>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MedicationFields({ medication, state }: { medication?: Medication; state: ActionState }) {
  const v = state.status === "error" ? state.values : undefined;
  return (
    <>
      {medication ? <input type="hidden" name="id" value={medication.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Nome" name="name" defaultValue={v?.name ?? medication?.name ?? ""} errors={state.fieldErrors?.name} />
        <FormField label="Apresentação" name="presentation" placeholder="Ex.: 500 mg cápsula" defaultValue={v?.presentation ?? medication?.presentation ?? ""} />
      </div>
      <FormField label="Posologia padrão" name="defaultDosage" defaultValue={v?.defaultDosage ?? medication?.default_dosage ?? ""} />
      <FormField label="Quantidade padrão" name="defaultQuantity" defaultValue={v?.defaultQuantity ?? medication?.default_quantity ?? ""} />
      <SwitchField name="specialControl" label="Controle especial" description="Antimicrobianos e controlados: receita em 2 vias." defaultChecked={v ? v.specialControl === "on" : (medication?.special_control ?? false)} />
      <SwitchField name="active" label="Ativo" defaultChecked={v ? v.active === "on" : (medication?.active ?? true)} />
    </>
  );
}

export function MedicationsManager({ medications }: { medications: Medication[] }) {
  return (
    <div className="space-y-3">
      <FormDialog title="Novo medicamento" action={saveMedication} submitLabel="Cadastrar" trigger={<Button variant="outline"><Plus aria-hidden />Novo medicamento</Button>}>
        {(state) => <MedicationFields state={state} />}
      </FormDialog>
      <ul className="divide-y rounded-xl border">
        {medications.map((m) => (
          <li key={m.id} className="flex items-center gap-4 px-4 py-2.5 sm:px-5">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                {m.name} <span className="font-normal text-muted-foreground">{m.presentation}</span>
                {m.special_control ? <Badge variant="outline">Controle especial</Badge> : null}
                {!m.active ? <Badge variant="secondary">Inativo</Badge> : null}
              </p>
              <p className="truncate text-xs text-muted-foreground">{m.default_dosage}</p>
            </div>
            <FormDialog title="Editar medicamento" action={saveMedication} trigger={<Button variant="ghost" size="icon" aria-label={`Editar ${m.name} ${m.presentation ?? ""}`}><Pencil /></Button>}>
              {(state) => <MedicationFields medication={m} state={state} />}
            </FormDialog>
          </li>
        ))}
      </ul>
    </div>
  );
}
