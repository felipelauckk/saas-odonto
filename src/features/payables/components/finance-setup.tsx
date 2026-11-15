"use client";

import { Pencil, Plus } from "lucide-react";

import { FormDialog } from "@/components/forms/form-dialog";
import { FormField } from "@/components/forms/form-field";
import { SelectField } from "@/components/forms/select-field";
import { SwitchField } from "@/components/forms/switch-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCpfCnpj, formatPhone } from "@/lib/documents";

import { saveCategory, saveCostCenter, saveSupplier } from "../actions";

type Category = { id: string; type: "income" | "expense"; name: string; active: boolean };
type Supplier = { id: string; name: string; document: string | null; phone: string | null; email: string | null; notes: string | null; active: boolean };
type CostCenter = { id: string; name: string; active: boolean };

const editButton = (label: string) => (
  <Button variant="ghost" size="icon" aria-label={`Editar ${label}`}>
    <Pencil />
  </Button>
);

export function CategoriesSetup({ categories }: { categories: Category[] }) {
  return (
    <div className="space-y-3">
      <FormDialog title="Nova categoria" action={saveCategory} submitLabel="Criar" trigger={<Button variant="outline"><Plus aria-hidden />Nova categoria</Button>}>
        {(state) => (
          <>
            <SelectField name="type" label="Tipo" options={[{ value: "expense", label: "Despesa" }, { value: "income", label: "Receita" }]} defaultValue={state.values?.type ?? "expense"} />
            <FormField label="Nome" name="name" defaultValue={state.values?.name ?? ""} errors={state.fieldErrors?.name} />
            <SwitchField name="active" label="Ativa" defaultChecked />
          </>
        )}
      </FormDialog>
      {(["income", "expense"] as const).map((type) => (
        <div key={type} className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{type === "income" ? "Receitas" : "Despesas"}</p>
          <ul className="divide-y rounded-xl border">
            {categories.filter((c) => c.type === type).map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-2 text-sm sm:px-5">
                <span className="flex-1">{c.name}</span>
                {!c.active ? <Badge variant="secondary">Inativa</Badge> : null}
                <FormDialog title="Editar categoria" action={saveCategory} trigger={editButton(c.name)}>
                  {(state) => (
                    <>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="type" value={c.type} />
                      <FormField label="Nome" name="name" defaultValue={state.values?.name ?? c.name} errors={state.fieldErrors?.name} />
                      <SwitchField name="active" label="Ativa" defaultChecked={c.active} />
                    </>
                  )}
                </FormDialog>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function SupplierFields({ s, values, errors }: { s?: Supplier; values?: Record<string, string>; errors?: Partial<Record<string, string[]>> }) {
  return (
    <>
      {s ? <input type="hidden" name="id" value={s.id} /> : null}
      <FormField label="Nome" name="name" defaultValue={values?.name ?? s?.name ?? ""} errors={errors?.name} />
      <div className="grid grid-cols-2 gap-4">
        <FormField label="CNPJ ou CPF" name="document" defaultValue={values?.document ?? (s?.document ? formatCpfCnpj(s.document) : "")} errors={errors?.document} />
        <FormField label="Telefone" name="phone" defaultValue={values?.phone ?? (s?.phone ? formatPhone(s.phone) : "")} errors={errors?.phone} />
      </div>
      <FormField label="E-mail" name="email" defaultValue={values?.email ?? s?.email ?? ""} />
      <FormField label="Observações" name="notes" defaultValue={values?.notes ?? s?.notes ?? ""} />
      <SwitchField name="active" label="Ativo" defaultChecked={s?.active ?? true} />
    </>
  );
}

export function SuppliersSetup({ suppliers }: { suppliers: Supplier[] }) {
  return (
    <div className="space-y-3">
      <FormDialog title="Novo fornecedor" action={saveSupplier} submitLabel="Cadastrar" trigger={<Button variant="outline"><Plus aria-hidden />Novo fornecedor</Button>}>
        {(state) => <SupplierFields values={state.status === "error" ? state.values : undefined} errors={state.fieldErrors} />}
      </FormDialog>
      {suppliers.length ? (
        <ul className="divide-y rounded-xl border">
          {suppliers.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-4 py-2 text-sm sm:px-5">
              <span className="flex-1">
                {s.name} <span className="text-muted-foreground">{s.phone ? formatPhone(s.phone) : ""}</span>
              </span>
              {!s.active ? <Badge variant="secondary">Inativo</Badge> : null}
              <FormDialog title="Editar fornecedor" action={saveSupplier} trigger={editButton(s.name)}>
                {(state) => <SupplierFields s={s} values={state.status === "error" ? state.values : undefined} errors={state.fieldErrors} />}
              </FormDialog>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhum fornecedor cadastrado.</p>
      )}
    </div>
  );
}

export function CostCentersSetup({ costCenters }: { costCenters: CostCenter[] }) {
  return (
    <div className="space-y-3">
      <FormDialog title="Novo centro de custo" action={saveCostCenter} submitLabel="Criar" trigger={<Button variant="outline"><Plus aria-hidden />Novo centro de custo</Button>}>
        {(state) => (
          <>
            <FormField label="Nome" name="name" defaultValue={state.values?.name ?? ""} errors={state.fieldErrors?.name} />
            <SwitchField name="active" label="Ativo" defaultChecked />
          </>
        )}
      </FormDialog>
      {costCenters.length ? (
        <ul className="divide-y rounded-xl border">
          {costCenters.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-2 text-sm sm:px-5">
              <span className="flex-1">{c.name}</span>
              <FormDialog title="Editar centro de custo" action={saveCostCenter} trigger={editButton(c.name)}>
                {(state) => (
                  <>
                    <input type="hidden" name="id" value={c.id} />
                    <FormField label="Nome" name="name" defaultValue={state.values?.name ?? c.name} errors={state.fieldErrors?.name} />
                    <SwitchField name="active" label="Ativo" defaultChecked={c.active} />
                  </>
                )}
              </FormDialog>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Opcional: use para separar despesas por área (ex.: ortodontia, implantes).</p>
      )}
    </div>
  );
}
