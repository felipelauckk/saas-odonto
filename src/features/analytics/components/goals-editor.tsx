"use client";

import { useState, useTransition } from "react";

import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { centsToInput } from "@/lib/money";

import { saveGoals } from "../actions";
import { goalMetrics, metricKind, metricLabels, type GoalMetric } from "../logic";

type Scope = { key: string; label: string; unitId: string | null; professionalId: string | null };
type Goal = { metric: GoalMetric; unitId: string | null; professionalId: string | null; target: number };

const scopeKey = (unitId: string | null, professionalId: string | null) => (unitId ? `u:${unitId}` : professionalId ? `p:${professionalId}` : "clinic");

function toInput(metric: GoalMetric, target: number) {
  const kind = metricKind[metric];
  if (kind === "money") return centsToInput(Math.round(target));
  if (kind === "percent") return String(Math.round(target * 1000) / 10).replace(".", ",");
  return String(target).replace(".", ",");
}

export function GoalsEditor({ month, scopes, goals }: { month: string; scopes: Scope[]; goals: Goal[] }) {
  const initial = Object.fromEntries(goals.map((g) => [`${scopeKey(g.unitId, g.professionalId)}|${g.metric}`, toInput(g.metric, g.target)]));
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [message, setMessage] = useState<{ status: "error" | "success"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  // Novos pacientes não têm unidade/profissional: só no total da clínica.
  const metricsFor = (s: Scope) => goalMetrics.filter((m) => m !== "new_patients" || s.key === "clinic");

  return (
    <div className="space-y-4">
      {message ? <FormMessage state={message} /> : null}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Meta de</th>
              {goalMetrics.map((m) => (
                <th key={m} scope="col" className="px-2 py-2 font-medium whitespace-nowrap sm:whitespace-normal">
                  {metricLabels[m]}
                  {metricKind[m] === "money" ? " (R$)" : metricKind[m] === "percent" ? " (%)" : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {scopes.map((s) => (
              <tr key={s.key}>
                <th scope="row" className="px-3 py-2 text-left font-medium whitespace-nowrap">{s.label}</th>
                {goalMetrics.map((m) => {
                  const key = `${s.key}|${m}`;
                  return (
                    <td key={m} className="px-2 py-2">
                      {metricsFor(s).includes(m) ? (
                        <Input
                          aria-label={`${metricLabels[m]} · ${s.label}`}
                          inputMode="decimal"
                          className="w-full min-w-20 max-w-32"
                          value={values[key] ?? ""}
                          onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Deixe em branco para não ter meta. Conversão em porcentagem (ex.: 40).</p>
      <Button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const list = scopes.flatMap((s) => metricsFor(s).map((m) => ({ metric: m, unitId: s.unitId, professionalId: s.professionalId, value: values[`${s.key}|${m}`] ?? "" })));
            const r = await saveGoals({ month, goals: list });
            setMessage(r.error ? { status: "error", message: r.error } : { status: "success", message: "Metas salvas." });
          })
        }
      >
        {pending ? "Salvando..." : "Salvar metas"}
      </Button>
    </div>
  );
}
