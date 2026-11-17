import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { KpiStrip, type Kpi } from "@/components/app/kpi-strip";
import { buttonVariants } from "@/components/ui/button";
import { ChartLegend, DueList, MonthBars, type DueRow } from "@/features/finance/components/finance-overview";
import { dueUrgency, lastMonths, margin, monthlyFlow } from "@/features/finance/overview";
import { getCashDay, getReceivablesSummary, getUpcomingDues } from "@/features/finance/queries";
import { getCashFlow } from "@/features/payables/queries";
import { requireClinic } from "@/features/tenancy/guards";
import { canManageClinic } from "@/features/tenancy/roles";
import { todayIso } from "@/lib/dates";
import { formatCurrency, formatCurrencyWhole } from "@/lib/format";
import { optional } from "@/lib/optional";
import { BlockError } from "@/components/feedback/block-error";

export const metadata: Metadata = { title: "Visão geral do financeiro" };

const monthLong = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" });

/** "16/11", ou "10/01/2020" quando não é do ano corrente. */
function dayMonth(date: string, today = todayIso()) {
  const [y, m, d] = date.split("-");
  return y === today.slice(0, 4) ? `${d}/${m}` : `${d}/${m}/${y}`;
}

export default async function Page() {
  const session = await requireClinic();
  if (!canManageClinic(session.clinic.role)) redirect("/financeiro");
  const today = todayIso();
  const months = lastMonths(today, 6);
  const unit = session.activeUnit;

  const [flow, summary, dues, cash] = await Promise.all([
    optional("financeiro", getCashFlow({ from: months[0]!, to: today, granularity: "month", unitId: null })),
    optional("financeiro", getReceivablesSummary()),
    optional("financeiro", getUpcomingDues(today)),
    unit ? optional("financeiro", getCashDay({ unitId: unit.id, date: today })) : Promise.resolve(null),
  ]);

  const series = flow.ok ? monthlyFlow(flow.value, today) : null;
  const current = series?.at(-1);
  const monthName = monthLong.format(new Date(`${today.slice(0, 7)}-01T12:00:00Z`));
  const m = current ? margin(current.inCents, current.outCents) : null;

  const kpis: Kpi[] = [
    ...(current
      ? [
          { label: `Entrou em ${monthName}`, value: formatCurrencyWhole(current.inCents), context: `até hoje · ${Number(today.slice(8))} dias` },
          { label: `Saiu em ${monthName}`, value: formatCurrencyWhole(current.outCents), context: "contas pagas e saídas do caixa", href: "/financeiro/pagar" },
          {
            label: "Resultado do mês",
            value: (
              <span className={current.resultCents >= 0 ? "text-success" : "text-destructive"}>
                {current.resultCents >= 0 ? "+ " : "− "}
                {formatCurrencyWhole(Math.abs(current.resultCents))}
              </span>
            ),
            context: m === null ? "sem entradas no mês" : `margem de ${Math.round(m * 100)}%`,
            href: "/financeiro/dre",
          },
        ]
      : []),
    ...(summary.ok
      ? [
          {
            label: "Vencido a receber",
            value: <span className={summary.value.overdue > 0 ? "text-destructive" : undefined}>{formatCurrencyWhole(summary.value.overdue)}</span>,
            context: summary.value.overdueCount === 1 ? "1 parcela vencida" : `${summary.value.overdueCount} parcelas vencidas`,
            href: "/financeiro?status=vencidos",
          },
        ]
      : []),
  ];

  const receivableRows: DueRow[] = dues.ok
    ? dues.value.receivables.rows.map((r) => ({
        id: r.id,
        date: r.due_date,
        urgency: dueUrgency(r.due_date, today),
        dateLabel: r.due_date < today ? `Venc. ${dayMonth(r.due_date)}` : dayMonth(r.due_date),
        who: r.patients?.full_name ?? "Paciente",
        what: [r.description, r.installment_total && r.installment_total > 1 ? `${r.installment_number} de ${r.installment_total}` : null].filter(Boolean).join(" · "),
        amountCents: r.amount_cents,
      }))
    : [];
  const payableRows: DueRow[] = dues.ok
    ? dues.value.payables.rows.map((p) => ({
        id: p.id,
        date: p.due_date,
        urgency: dueUrgency(p.due_date, today),
        dateLabel: p.due_date < today ? `Venc. ${dayMonth(p.due_date)}` : dayMonth(p.due_date),
        who: p.suppliers?.name ?? p.description,
        what: p.suppliers?.name ? p.description : "",
        amountCents: p.amount_cents,
      }))
    : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <Link href="/financeiro/conciliacao" className={buttonVariants({ variant: "outline" })}>
          Importar extrato (OFX)
        </Link>
        <Link href="/financeiro/pagar" className={buttonVariants({ variant: "outline" })}>
          Nova despesa
        </Link>
        <Link href="/financeiro" className={buttonVariants()}>
          Receber pagamento
        </Link>
      </div>

      {kpis.length ? <KpiStrip items={kpis} label="Resultado do mês" /> : <BlockError what="o resultado do mês" />}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
        <section aria-labelledby="seis-meses" className="space-y-4 rounded-card border bg-card p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-0.5">
              <h2 id="seis-meses" className="type-section">
                Entradas e saídas, últimos 6 meses
              </h2>
              <p className="text-[0.8125rem] text-muted-foreground">O resultado de cada mês aparece acima das barras. * mês em andamento.</p>
            </div>
            <ChartLegend />
          </div>
          {series ? <MonthBars months={series} /> : <BlockError what="as entradas e saídas" />}
        </section>

        {cash === null ? null : cash.ok ? (
          <section aria-labelledby="caixa-hoje" className="space-y-3 rounded-card border bg-card p-4 sm:p-5">
            <div className="flex items-baseline justify-between gap-2">
              <h2 id="caixa-hoje" className="type-section">
                Caixa de hoje
              </h2>
              <span className="text-xs text-muted-foreground">{unit?.name}</span>
            </div>
            <p className="type-kpi">{formatCurrencyWhole(cash.value.totalIn - cash.value.totalOut)}</p>
            {cash.value.byMethod.length ? (
              <ul className="divide-y divide-border-soft">
                {cash.value.byMethod.map(([name, cents]) => (
                  <li key={name} className="flex items-center justify-between gap-2 py-2 text-[0.8125rem]">
                    <span className="text-muted-foreground">{name}</span>
                    <span className={cents < 0 ? "font-medium text-destructive tabular-nums" : "font-medium tabular-nums"}>{formatCurrency(cents)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[0.8125rem] text-muted-foreground">Nenhum movimento hoje.</p>
            )}
            <Link href="/financeiro/caixa" className={buttonVariants({ variant: "outline", className: "w-full" })}>
              Abrir o caixa do dia
            </Link>
          </section>
        ) : (
          <BlockError what="o caixa de hoje" />
        )}
      </div>

      {dues.ok ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <DueList
            title="A receber nos próximos 7 dias"
            total={dues.value.receivables.total}
            count={dues.value.receivables.count}
            rows={receivableRows}
            href="/financeiro"
            empty="Nada a receber nos próximos 7 dias."
          />
          <DueList
            title="A pagar nos próximos 7 dias"
            total={dues.value.payables.total}
            count={dues.value.payables.count}
            rows={payableRows}
            href="/financeiro/pagar"
            empty="Nada a pagar nos próximos 7 dias."
          />
        </div>
      ) : (
        <BlockError what="os vencimentos" />
      )}
    </div>
  );
}
