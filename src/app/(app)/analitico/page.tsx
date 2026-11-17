import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles, Target } from "lucide-react";
import { z } from "zod";

import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { PeriodFilter } from "@/features/payables/components/period-filter";
import { GoalTile, HorizontalBars, MonthBars } from "@/features/analytics/components/charts";
import { actualOf, conversion, shortMonth, type GoalMetric } from "@/features/analytics/logic";
import { getAnalytics, getFunnel } from "@/features/analytics/queries";
import { requireManager } from "@/features/tenancy/guards";
import { todayIso } from "@/lib/dates";
import { formatCurrency } from "@/lib/format";
import { addDays } from "@/lib/timezone";
import { isAiConfigured } from "@/lib/ai/claude";

export const metadata: Metadata = { title: "Painel analítico" };

const integer = (v: number) => new Intl.NumberFormat("pt-BR").format(v);
const percent = (v: number) => new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 }).format(v);
const money = (v: number) => formatCurrency(Math.round(v));

export default async function Page({ searchParams }: PageProps<"/analitico">) {
  const session = await requireManager();
  const params = await searchParams;
  const today = todayIso();
  const month = z.string().regex(/^\d{4}-\d{2}$/).catch(today.slice(0, 7)).parse(params.mes);
  const unitId = z.uuid().nullable().catch(null).parse(params.unidade || null);
  const [data, funnel] = await Promise.all([getAnalytics({ month, unitId }), getFunnel(addDays(today, -89), today)]);
  const current = data.months.at(-1)!;
  const goal = (metric: GoalMetric) => data.goals.find((g) => g.metric === metric && g.unitId === unitId && g.professionalId === null)?.target;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Painel analítico"
        description="Evolução mensal, metas, funil e rankings."
        actions={
          <div className="flex gap-2">
            {isAiConfigured() ? (
              <Link href="/analitico/ia" className={buttonVariants({ variant: "outline" })}>
                <Sparkles aria-hidden />
                Perguntar à IA
              </Link>
            ) : null}
            <Link href={`/analitico/metas?mes=${month}`} className={buttonVariants({ variant: "outline" })}>
              <Target aria-hidden />
              Metas
            </Link>
          </div>
        }
      />
      <PeriodFilter
        fields={[{ name: "mes", label: "Mês", type: "month", value: month }]}
        selects={session.units.length > 1 ? [{ name: "unidade", label: "Unidade", value: unitId ?? "", options: [{ value: "", label: "Todas (consolidado)" }, ...session.units.map((u) => ({ value: u.id, label: u.name }))] }] : []}
      />

      <section aria-labelledby="metas" className="space-y-3">
        <h2 id="metas" className="text-base font-medium">Metas de {shortMonth(month)}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <GoalTile label="Faturamento (recebido)" actual={actualOf(current, "revenue")} target={goal("revenue")} format={money} />
          <GoalTile label="Produção" actual={actualOf(current, "production")} target={goal("production")} format={money} />
          <GoalTile label="Orçamentos aprovados" actual={actualOf(current, "approved_quotes")} target={goal("approved_quotes")} format={integer} />
          {!unitId ? <GoalTile label="Novos pacientes" actual={actualOf(current, "new_patients")} target={goal("new_patients")} format={integer} /> : null}
          <GoalTile label="Conversão de orçamentos" actual={conversion(current)} target={goal("conversion")} format={percent} />
        </div>
      </section>

      <section aria-labelledby="evolucao" className="space-y-3">
        <h2 id="evolucao" className="text-base font-medium">Evolução mensal (12 meses)</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          <MonthBars title="Faturamento (recebido)" data={data.months.map((m) => ({ label: shortMonth(m.month), value: m.revenue, highlight: m.month === month }))} format={money} />
          <MonthBars title="Produção" data={data.months.map((m) => ({ label: shortMonth(m.month), value: m.production, highlight: m.month === month }))} format={money} />
          <MonthBars title="Orçamentos aprovados" data={data.months.map((m) => ({ label: shortMonth(m.month), value: m.approvedQuotes, highlight: m.month === month }))} format={integer} />
          {!unitId ? <MonthBars title="Novos pacientes" data={data.months.map((m) => ({ label: shortMonth(m.month), value: m.newPatients, highlight: m.month === month }))} format={integer} /> : null}
        </div>
      </section>

      <section aria-labelledby="funil-ocupacao" className="grid gap-3 lg:grid-cols-2">
        <h2 id="funil-ocupacao" className="sr-only">Funil e ocupação</h2>
        <HorizontalBars title="Funil de captação (leads dos últimos 90 dias)" data={funnel} format={integer} max={Math.max(1, funnel[0]?.value ?? 0)} />
        <HorizontalBars title={`Ocupação da agenda em ${shortMonth(month)}`} data={data.occupancy.map((o) => ({ label: o.name, value: o.rate }))} format={percent} max={1} />
      </section>

      <section aria-labelledby="ranking" className="space-y-3">
        <h2 id="ranking" className="text-base font-medium">Ranking de profissionais em {shortMonth(month)}</h2>
        <RankingTable rows={data.professionals} goals={data.goals.filter((g) => g.professionalId)} kind="professional" />
      </section>

      {session.units.length > 1 && !unitId ? (
        <section aria-labelledby="unidades" className="space-y-3">
          <h2 id="unidades" className="text-base font-medium">Ranking de unidades em {shortMonth(month)}</h2>
          <RankingTable rows={data.units} goals={data.goals.filter((g) => g.unitId)} kind="unit" />
        </section>
      ) : null}
    </div>
  );
}

function RankingTable({
  rows,
  goals,
  kind,
}: {
  rows: { id: string; name: string; stats: Parameters<typeof conversion>[0] }[];
  goals: { metric: GoalMetric; unitId: string | null; professionalId: string | null; target: number }[];
  kind: "professional" | "unit";
}) {
  const sorted = [...rows].sort((a, b) => b.stats.revenue - a.stats.revenue || b.stats.production - a.stats.production);
  const target = (id: string, metric: GoalMetric) => goals.find((g) => g.metric === metric && (kind === "unit" ? g.unitId === id : g.professionalId === id))?.target;
  const pct = (a: number, t: number | undefined) => (t ? ` (${Math.round((a / t) * 100)}%)` : "");
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40 text-left text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-2 font-medium">#</th>
            <th scope="col" className="px-4 py-2 font-medium">{kind === "unit" ? "Unidade" : "Profissional"}</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">Faturamento</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">Produção</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">Orçamentos aprovados</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">Conversão</th>
          </tr>
        </thead>
        <tbody className="divide-y tabular-nums">
          {sorted.map((r, i) => {
            const conv = conversion(r.stats);
            return (
              <tr key={r.id}>
                <td className="px-4 py-2 text-muted-foreground">{i + 1}º</td>
                <td className="px-4 py-2">{r.name}</td>
                <td className="px-4 py-2 text-right">{money(r.stats.revenue)}{pct(r.stats.revenue, target(r.id, "revenue"))}</td>
                <td className="px-4 py-2 text-right">{money(r.stats.production)}{pct(r.stats.production, target(r.id, "production"))}</td>
                <td className="px-4 py-2 text-right">{integer(r.stats.approvedQuotes)}{pct(r.stats.approvedQuotes, target(r.id, "approved_quotes"))}</td>
                <td className="px-4 py-2 text-right">{conv === null ? "—" : percent(conv)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
