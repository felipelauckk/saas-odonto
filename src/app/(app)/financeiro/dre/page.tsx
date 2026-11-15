import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";

import { PeriodFilter } from "@/features/payables/components/period-filter";
import { getDre } from "@/features/payables/queries";
import { requireClinic } from "@/features/tenancy/guards";
import { canManageClinic } from "@/features/tenancy/roles";
import { todayIso } from "@/lib/dates";
import { formatCurrency } from "@/lib/format";

export const metadata: Metadata = { title: "DRE" };

export default async function Page({ searchParams }: PageProps<"/financeiro/dre">) {
  const session = await requireClinic();
  if (!canManageClinic(session.clinic.role)) redirect("/financeiro");
  const raw = await searchParams;
  const month = z.string().regex(/^\d{4}-\d{2}$/).catch(todayIso().slice(0, 7)).parse(raw.mes);
  const scope = raw.escopo === "unidade" ? "unidade" : "todas";
  const dre = await getDre({ month, unitId: scope === "unidade" ? (session.activeUnit?.id ?? null) : null });
  const line = (label: string, value: number, opts: { strong?: boolean; negative?: boolean; indent?: boolean } = {}) => (
    <tr key={label} className={opts.strong ? "font-medium" : undefined}>
      <td className={`px-4 py-2 ${opts.indent ? "pl-8 text-muted-foreground" : ""}`}>{label}</td>
      <td className={`px-4 py-2 text-right tabular-nums ${opts.strong && value < 0 ? "text-destructive" : ""}`}>{opts.negative ? `- ${formatCurrency(value)}` : formatCurrency(value)}</td>
    </tr>
  );
  return (
    <div className="space-y-6">
      <PeriodFilter
        fields={[{ name: "mes", label: "Mês", type: "month", value: month }]}
        selects={session.units.length > 1 ? [{ name: "escopo", label: "Unidades", value: scope, options: [{ value: "todas", label: "Consolidado" }, { value: "unidade", label: session.activeUnit?.name ?? "Unidade atual" }] }] : []}
      />
      <div className="max-w-2xl overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <tbody className="divide-y">
            {line("Receita bruta (recebido no mês)", dre.grossRevenue, { strong: true })}
            {line("Taxas das formas de pagamento", dre.fees, { negative: true, indent: true })}
            {line("Receita líquida", dre.netRevenue, { strong: true })}
            {dre.expenses.map((e) => line(e.category, e.amountCents, { negative: true, indent: true }))}
            {line("Total de despesas", dre.totalExpenses, { negative: true, strong: true })}
            {line("Resultado do mês", dre.result, { strong: true })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">DRE gerencial pelo regime de caixa: receitas e despesas entram no mês em que foram pagas.</p>
    </div>
  );
}
