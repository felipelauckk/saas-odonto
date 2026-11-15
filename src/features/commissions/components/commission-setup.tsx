"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "cn";

import { FormMessage } from "@/components/forms/form-message";
import { SimpleSelect } from "@/components/forms/simple-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/format";
import { parseBRLToCents, parseDecimal } from "@/lib/money";

import { addCommissionRule, deleteCommissionRule, saveCommissionSettings, setDefaultPercent } from "../actions";

type Settings = { base: "received" | "executed"; deductFees: boolean; deductLab: boolean };

export function CommissionSettingsForm({ initial }: { initial: Settings }) {
  const [s, setS] = useState(initial);
  const [msg, setMsg] = useState<{ status: "error" | "success"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const segment = (active: boolean) => cn("h-9 flex-1 rounded-md px-3 text-sm font-medium pointer-coarse:h-11", active ? "bg-background shadow-xs" : "text-muted-foreground");
  return (
    <div className="space-y-4">
      {msg ? <FormMessage state={msg} /> : null}
      <div className="flex max-w-md rounded-lg bg-muted p-1" role="group" aria-label="Base de cálculo">
        <button type="button" className={segment(s.base === "received")} aria-pressed={s.base === "received"} onClick={() => setS({ ...s, base: "received" })}>Sobre o recebido</button>
        <button type="button" className={segment(s.base === "executed")} aria-pressed={s.base === "executed"} onClick={() => setS({ ...s, base: "executed" })}>Sobre o executado</button>
      </div>
      <Label className="flex items-center gap-3 font-normal pointer-coarse:min-h-11">
        <Checkbox checked={s.deductFees} onCheckedChange={(c) => setS({ ...s, deductFees: c === true })} />
        Descontar a taxa da forma de pagamento antes da comissão
      </Label>
      <Label className="flex items-center gap-3 font-normal pointer-coarse:min-h-11">
        <Checkbox checked={s.deductLab} onCheckedChange={(c) => setS({ ...s, deductLab: c === true })} />
        Descontar o custo de laboratório antes da comissão
      </Label>
      <Button disabled={pending} onClick={() => startTransition(async () => {
        const r = await saveCommissionSettings(s);
        setMsg(r.error ? { status: "error", message: r.error } : { status: "success", message: r.message ?? "Salvo." });
      })}>
        Salvar
      </Button>
    </div>
  );
}

type Rule = { id: string; procedure_id: string | null; category: string | null; percent: number | null; fixed_cents: number | null; procedures: { name: string } | null };

export function ProfessionalCommission({
  professional,
  rules,
  procedures,
  categories,
}: {
  professional: { id: string; name: string; commission_percent: number | null };
  rules: Rule[];
  procedures: { id: string; name: string }[];
  categories: string[];
}) {
  const [percent, setPercent] = useState(professional.commission_percent?.toString().replace(".", ",") ?? "");
  const [target, setTarget] = useState<string>(procedures[0] ? `p:${procedures[0].id}` : "none");
  const [kind, setKind] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("");
  const [msg, setMsg] = useState<{ status: "error" | "success"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<{ error?: string }>, ok?: string) =>
    startTransition(async () => {
      const r = await fn();
      setMsg(r.error ? { status: "error", message: r.error } : ok ? { status: "success", message: ok } : null);
    });

  return (
    <section className="space-y-3 rounded-xl border p-5" aria-label={`Comissão de ${professional.name}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h3 className="font-medium">{professional.name}</h3>
        <div className="flex items-end gap-2">
          <div className="space-y-1.5">
            <Label htmlFor={`pct-${professional.id}`}>Percentual padrão</Label>
            <Input id={`pct-${professional.id}`} inputMode="decimal" className="w-24" value={percent} onChange={(e) => setPercent(e.target.value)} />
          </div>
          <Button variant="outline" disabled={pending} onClick={() => {
            const n = parseDecimal(percent || "0");
            if (n === null || n > 100) return setMsg({ status: "error", message: "Percentual entre 0 e 100." });
            run(() => setDefaultPercent(professional.id, n), "Percentual salvo.");
          }}>Salvar %</Button>
        </div>
      </div>
      {msg ? <FormMessage state={msg} /> : null}
      {rules.length ? (
        <ul className="divide-y rounded-lg border text-sm">
          {rules.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-3 py-2">
              <span className="flex-1">{r.procedures?.name ?? `Categoria: ${r.category}`}</span>
              <span className="tabular-nums">{r.fixed_cents !== null ? `${formatCurrency(r.fixed_cents)} fixo` : `${Number(r.percent).toLocaleString("pt-BR")}%`}</span>
              <Button variant="ghost" size="icon-sm" aria-label={`Remover exceção ${r.procedures?.name ?? r.category}`} disabled={pending} onClick={() => run(() => deleteCommissionRule(r.id))}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-56 flex-1">
          <SimpleSelect
            id={`rule-target-${professional.id}`}
            label="Exceção para"
            value={target}
            onChange={setTarget}
            options={[...procedures.map((p) => ({ value: `p:${p.id}`, label: p.name })), ...categories.map((c) => ({ value: `c:${c}`, label: `Categoria: ${c}` }))]}
          />
        </div>
        <SimpleSelect
          id={`rule-kind-${professional.id}`}
          label="Tipo"
          value={kind}
          onChange={(v) => setKind(v as "percent" | "fixed")}
          options={[{ value: "percent", label: "Percentual" }, ...(target.startsWith("p:") ? [{ value: "fixed", label: "Valor fixo" }] : [])]}
          className="w-36 data-[size=default]:h-9 pointer-coarse:data-[size=default]:h-11"
        />
        <div className="space-y-1.5">
          <Label htmlFor={`rule-value-${professional.id}`}>{kind === "percent" ? "%" : "R$"}</Label>
          <Input id={`rule-value-${professional.id}`} inputMode="decimal" className="w-24" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <Button variant="outline" disabled={pending} onClick={() => {
          const isFixed = kind === "fixed" && target.startsWith("p:");
          const n = isFixed ? parseBRLToCents(value) : parseDecimal(value);
          if (n === null) return setMsg({ status: "error", message: "Valor inválido." });
          run(() => addCommissionRule({
            professionalId: professional.id,
            procedureId: target.startsWith("p:") ? target.slice(2) : null,
            category: target.startsWith("c:") ? target.slice(2) : null,
            percent: isFixed ? null : n,
            fixedCents: isFixed ? n : null,
          }));
          setValue("");
        }}>
          Adicionar exceção
        </Button>
      </div>
    </section>
  );
}
