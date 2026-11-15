import type { Metadata } from "next";
import { z } from "zod";

import { SubpageHeader } from "@/components/layout/subpage-header";
import { sourceLabels } from "@/features/crm/labels";
import { getCrmReport } from "@/features/crm/queries";
import { PeriodFilter } from "@/features/payables/components/period-filter";
import { requireFrontDesk } from "@/features/tenancy/guards";
import { todayIso } from "@/lib/dates";
import { formatCurrency } from "@/lib/format";
import { addDays } from "@/lib/timezone";

export const metadata: Metadata = { title: "Conversão do CRM" };

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });
const rate = (a: number, b: number) => (b ? percent.format(a / b) : "—");

export default async function Page({ searchParams }: PageProps<"/crm/relatorio">) {
  await requireFrontDesk();
  const params = await searchParams;
  const to = isoDate.catch(todayIso()).parse(params.ate);
  const from = isoDate.catch(addDays(to, -89)).parse(params.de);
  const report = await getCrmReport(from, to);
  const th = "px-4 py-2 font-medium";
  const td = "px-4 py-2 text-right";

  return (
    <div className="space-y-8">
      <SubpageHeader title="Conversão do CRM" description={`Leads criados no período: ${report.total}.`} backHref="/crm" backLabel="CRM" />
      <PeriodFilter fields={[{ name: "de", label: "De", type: "date", value: from }, { name: "ate", label: "Até", type: "date", value: to }]} />

      <section className="space-y-2" aria-labelledby="por-origem">
        <h2 id="por-origem" className="text-base font-medium">Por origem</h2>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-muted-foreground">
              <tr><th className={th}>Origem</th><th className={`${th} text-right`}>Leads</th><th className={`${th} text-right`}>Viraram paciente</th><th className={`${th} text-right`}>Fecharam</th><th className={`${th} text-right`}>Conversão</th><th className={`${th} text-right`}>Perdidos</th></tr>
            </thead>
            <tbody className="divide-y tabular-nums">
              {report.bySource.length ? report.bySource.map((r) => (
                <tr key={r.source}><td className="px-4 py-2">{sourceLabels[r.source]}</td><td className={td}>{r.leads}</td><td className={td}>{r.converted}</td><td className={td}>{r.won}</td><td className={td}>{rate(r.won, r.leads)}</td><td className={td}>{r.lost}</td></tr>
              )) : <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Nenhum lead no período.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2" aria-labelledby="por-campanha">
        <h2 id="por-campanha" className="text-base font-medium">Por campanha</h2>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-muted-foreground">
              <tr><th className={th}>Campanha</th><th className={`${th} text-right`}>Investido</th><th className={`${th} text-right`}>Leads</th><th className={`${th} text-right`}>Custo por lead</th><th className={`${th} text-right`}>Fecharam</th><th className={`${th} text-right`}>Custo por fechamento</th></tr>
            </thead>
            <tbody className="divide-y tabular-nums">
              {report.byCampaign.length ? report.byCampaign.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2">{c.name}</td>
                  <td className={td}>{c.costCents ? formatCurrency(c.costCents) : "—"}</td>
                  <td className={td}>{c.leads}</td>
                  <td className={td}>{c.costCents && c.leads ? formatCurrency(Math.round(c.costCents / c.leads)) : "—"}</td>
                  <td className={td}>{c.won}</td>
                  <td className={td}>{c.costCents && c.won ? formatCurrency(Math.round(c.costCents / c.won)) : "—"}</td>
                </tr>
              )) : <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">Nenhuma campanha com leads no período.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">O valor investido é o total informado na campanha (Configurações &gt; CRM).</p>
      </section>

      <section className="space-y-2" aria-labelledby="indicacoes">
        <h2 id="indicacoes" className="text-base font-medium">Quem mais indica</h2>
        {report.ranking.length ? (
          <ol className="divide-y rounded-xl border">
            {report.ranking.map((r, i) => (
              <li key={r.key} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className="w-6 tabular-nums text-muted-foreground">{i + 1}º</span>
                <span className="flex-1">{r.name} <span className="text-muted-foreground">· {r.kind}</span></span>
                <span className="tabular-nums">{r.leads} {r.leads === 1 ? "indicação" : "indicações"}{r.won ? ` · ${r.won} fechou` : ""}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-xl border border-dashed px-6 py-8 text-center text-sm text-muted-foreground">Nenhuma indicação no período.</p>
        )}
      </section>
    </div>
  );
}
