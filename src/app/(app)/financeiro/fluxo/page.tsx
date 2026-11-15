import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";

import { PeriodFilter } from "@/features/payables/components/period-filter";
import { getCashFlow } from "@/features/payables/queries";
import { requireClinic } from "@/features/tenancy/guards";
import { canManageClinic } from "@/features/tenancy/roles";
import { formatIsoDate, todayIso } from "@/lib/dates";
import { formatCurrency } from "@/lib/format";
import { addDays } from "@/lib/timezone";

export const metadata: Metadata = { title: "Fluxo de caixa" };

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export default async function Page({ searchParams }: PageProps<"/financeiro/fluxo">) {
  const session = await requireClinic();
  if (!canManageClinic(session.clinic.role)) redirect("/financeiro");
  const raw = await searchParams;
  const today = todayIso();
  const from = isoDate.catch(addDays(today, -30)).parse(raw.de);
  const to = isoDate.catch(addDays(today, 60)).parse(raw.ate);
  const granularity = z.enum(["day", "week", "month"]).catch("week").parse(raw.por);
  const scope = raw.escopo === "unidade" ? "unidade" : "todas";
  const unitId = scope === "unidade" ? (session.activeUnit?.id ?? null) : null;
  const rows = await getCashFlow({ from, to, granularity, unitId });

  const label = (bucket: string) => (granularity === "month" ? new Date(`${bucket}T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) : granularity === "week" ? `Semana de ${formatIsoDate(bucket)}` : formatIsoDate(bucket));

  return (
    <div className="space-y-6">
      <PeriodFilter
        fields={[
          { name: "de", label: "De", type: "date", value: from },
          { name: "ate", label: "Até", type: "date", value: to },
        ]}
        selects={[
          { name: "por", label: "Agrupar por", value: granularity, options: [{ value: "day", label: "Dia" }, { value: "week", label: "Semana" }, { value: "month", label: "Mês" }] },
          ...(session.units.length > 1 ? [{ name: "escopo", label: "Unidades", value: scope, options: [{ value: "todas", label: "Consolidado" }, { value: "unidade", label: session.activeUnit?.name ?? "Unidade atual" }] }] : []),
        ]}
      />
      <p className="text-sm text-muted-foreground">Realizado = movimentos do caixa. Previsto = contas a receber e a pagar em aberto, pelo vencimento.</p>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Período</th>
              <th className="px-4 py-2 text-right font-medium">Entradas</th>
              <th className="px-4 py-2 text-right font-medium">Saídas</th>
              <th className="px-4 py-2 text-right font-medium">A receber</th>
              <th className="px-4 py-2 text-right font-medium">A pagar</th>
              <th className="px-4 py-2 text-right font-medium">Saldo acumulado</th>
            </tr>
          </thead>
          <tbody className="divide-y tabular-nums">
            {rows.length ? (
              rows.map((r) => (
                <tr key={r.bucket}>
                  <td className="px-4 py-2 first-letter:uppercase">{label(r.bucket)}</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(r.realizedIn)}</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(r.realizedOut)}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground">{formatCurrency(r.expectedIn)}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground">{formatCurrency(r.expectedOut)}</td>
                  <td className={`px-4 py-2 text-right font-medium ${r.balance < 0 ? "text-destructive" : ""}`}>{formatCurrency(r.balance)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhum movimento no período.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
