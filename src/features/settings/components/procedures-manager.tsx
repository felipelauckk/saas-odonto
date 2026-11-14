"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Search, Stethoscope } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { FormDialog } from "@/components/forms/form-dialog";
import { FormField } from "@/components/forms/form-field";
import { SwitchField } from "@/components/forms/switch-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionState } from "@/lib/action-state";
import { formatCurrency } from "@/lib/format";
import { centsToInput } from "@/lib/money";

import { saveProcedure } from "../actions/procedures";
import { StatusBadge } from "./status-badge";

export type ProcedureItem = {
  id: string;
  name: string;
  code: string | null;
  category: string | null;
  price_cents: number;
  duration_min: number;
  applies_to_tooth: boolean;
  active: boolean;
};

const CATEGORY_LIST_ID = "categorias-procedimentos";

function ProcedureFields({ procedure, state }: { procedure?: ProcedureItem; state: ActionState }) {
  const v = state.status === "error" ? state.values : undefined;
  const e = state.fieldErrors;
  return (
    <>
      {procedure ? <input type="hidden" name="id" value={procedure.id} /> : null}
      <FormField label="Nome" name="name" required defaultValue={v?.name ?? procedure?.name ?? ""} errors={e?.name} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Preço (R$)"
          name="price"
          inputMode="decimal"
          placeholder="0,00"
          defaultValue={v?.price ?? (procedure ? centsToInput(procedure.price_cents) : "")}
          errors={e?.price}
        />
        <FormField
          label="Duração (minutos)"
          name="durationMin"
          inputMode="numeric"
          defaultValue={v?.durationMin ?? String(procedure?.duration_min ?? 30)}
          errors={e?.durationMin}
        />
        <FormField
          label="Categoria"
          name="category"
          list={CATEGORY_LIST_ID}
          placeholder="Ex.: Dentística"
          defaultValue={v?.category ?? procedure?.category ?? ""}
          errors={e?.category}
        />
        <FormField
          label="Código (opcional)"
          name="code"
          defaultValue={v?.code ?? procedure?.code ?? ""}
          errors={e?.code}
        />
      </div>
      <SwitchField
        name="appliesToTooth"
        label="Feito por dente"
        description="Pede o dente (e as faces) ao incluir no orçamento."
        defaultChecked={v ? v.appliesToTooth === "on" : (procedure?.applies_to_tooth ?? false)}
      />
      <SwitchField
        name="active"
        label="Procedimento ativo"
        description="Inativos não aparecem ao montar orçamentos."
        defaultChecked={v ? v.active === "on" : (procedure?.active ?? true)}
      />
    </>
  );
}

export function NewProcedureButton() {
  return (
    <FormDialog
      title="Novo procedimento"
      action={saveProcedure}
      submitLabel="Criar procedimento"
      trigger={
        <Button>
          <Plus aria-hidden />
          Novo procedimento
        </Button>
      }
    >
      {(state) => <ProcedureFields state={state} />}
    </FormDialog>
  );
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function ProceduresList({ procedures }: { procedures: ProcedureItem[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [onlyUnpriced, setOnlyUnpriced] = useState(false);

  const categories = useMemo(
    () => [...new Set(procedures.map((p) => p.category).filter((c): c is string => Boolean(c)))].sort(),
    [procedures],
  );
  const unpriced = procedures.filter((p) => p.active && p.price_cents === 0).length;

  const filtered = procedures.filter((p) => {
    if (category && p.category !== category) return false;
    if (onlyUnpriced && !(p.active && p.price_cents === 0)) return false;
    if (query && !normalize(`${p.name} ${p.code ?? ""}`).includes(normalize(query))) return false;
    return true;
  });

  if (!procedures.length) {
    return <EmptyState icon={Stethoscope} title="Nenhum procedimento" description="Cadastre os procedimentos que a clínica realiza." />;
  }

  const chip = (active: boolean) =>
    `inline-flex h-8 items-center rounded-full border px-3 text-sm transition-colors pointer-coarse:h-11 ${
      active ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted"
    }`;

  return (
    <div className="space-y-4">
      <datalist id={CATEGORY_LIST_ID}>
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      {unpriced ? (
        <div className="flex flex-col gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <span>
            {unpriced === 1 ? "1 procedimento está" : `${unpriced} procedimentos estão`} sem preço. Defina os valores da
            clínica antes de montar orçamentos.
          </span>
          <button type="button" className="font-medium underline underline-offset-4" onClick={() => setOnlyUnpriced((v) => !v)}>
            {onlyUnpriced ? "Mostrar todos" : "Ver só os sem preço"}
          </button>
        </div>
      ) : null}

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          placeholder="Buscar procedimento"
          aria-label="Buscar procedimento"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-8"
        />
      </div>

      {categories.length > 1 ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por categoria">
          <button type="button" className={chip(category === null)} aria-pressed={category === null} onClick={() => setCategory(null)}>
            Todas
          </button>
          {categories.map((c) => (
            <button key={c} type="button" className={chip(category === c)} aria-pressed={category === c} onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
        </div>
      ) : null}

      {filtered.length ? (
        <ul className="divide-y rounded-xl border">
          {filtered.map((p) => (
            <li key={p.id} className="flex items-center gap-4 px-4 py-3 sm:px-5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{p.name}</span>
                  {!p.active ? <StatusBadge active={false} /> : null}
                </div>
                <p className="text-sm text-muted-foreground">
                  {[p.category, `${p.duration_min} min`, p.applies_to_tooth ? "por dente" : null, p.code].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="shrink-0 text-right text-sm tabular-nums">
                {p.price_cents === 0 ? (
                  <Badge variant="outline" className="border-amber-300 text-amber-800 dark:border-amber-500/40 dark:text-amber-300">
                    Sem preço
                  </Badge>
                ) : (
                  formatCurrency(p.price_cents)
                )}
              </div>
              <FormDialog
                title="Editar procedimento"
                action={saveProcedure}
                trigger={
                  <Button variant="ghost" size="icon" aria-label={`Editar ${p.name}`}>
                    <Pencil />
                  </Button>
                }
              >
                {(state) => <ProcedureFields procedure={p} state={state} />}
              </FormDialog>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
          Nenhum procedimento encontrado com esses filtros.
        </p>
      )}
    </div>
  );
}
