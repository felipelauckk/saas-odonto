import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "cn";

import { KpiStrip, type Kpi } from "@/components/app/kpi-strip";
import { buttonVariants } from "@/components/ui/button";
import { getFunnel } from "@/features/analytics/queries";
import { BlockError, DashboardCard } from "@/features/dashboard/components/dashboard-card";
import { DaySummaryBanner } from "@/features/dashboard/components/day-summary";
import { FunnelBars } from "@/features/dashboard/components/funnel-card";
import { RecoveryList } from "@/features/dashboard/components/recovery-list";
import { RevenueChart } from "@/features/dashboard/components/revenue-chart";
import { TodayTimeline } from "@/features/dashboard/components/today-timeline";
import { daySummary, greeting, relativeChange, revenuePace } from "@/features/dashboard/logic";
import {
  getAppointmentTrend,
  getDashboardMetrics,
  getQuoteConversion,
  getRecoveryQueues,
  getRevenueGoal,
  getRevenueSeries,
  getTodayAppointments,
} from "@/features/dashboard/queries";
import { requireClinic } from "@/features/tenancy/guards";
import { canManageClinic } from "@/features/tenancy/roles";
import { todayIso } from "@/lib/dates";
import { formatCurrency, formatCurrencyWhole } from "@/lib/format";
import { addDays, formatLongDate, utcToZoned } from "@/lib/timezone";

export const metadata: Metadata = { title: "Painel" };

const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });
const signedPercent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0, signDisplay: "exceptZero" });
const monthLong = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" });

/** Bloco opcional: se falhar, só ele mostra o erro (o resto do painel segue). */
async function optional<T>(promise: Promise<T> | null): Promise<{ ok: true; value: T } | { ok: false } | null> {
  if (!promise) return null;
  try {
    return { ok: true, value: await promise };
  } catch (error) {
    console.error("[painel]", error);
    return { ok: false };
  }
}

function monthName(month: string) {
  return monthLong.format(new Date(`${month}-01T00:00:00Z`));
}

export default async function Page({ searchParams }: PageProps<"/painel">) {
  const session = await requireClinic();
  const { escopo } = await searchParams;
  const role = session.clinic.role;
  const manager = canManageClinic(role);
  const isDentist = role === "dentist";
  const multiUnit = session.units.length > 1;
  // Gestão vê o consolidado por padrão quando há mais de uma unidade.
  const consolidated = multiUnit && manager && escopo !== "unidade";
  const unitId = multiUnit && !consolidated ? (session.activeUnit?.id ?? null) : null;

  const today = todayIso();
  const month = today.slice(0, 7);
  const prevMonth = addDays(`${month}-01`, -1).slice(0, 7);
  const now = utcToZoned(new Date());

  const [metrics, todayList, trend, revenue, conversion, goal, funnel, recovery] = await Promise.all([
    getDashboardMetrics(unitId),
    getTodayAppointments(unitId),
    optional(getAppointmentTrend(unitId, today)),
    optional(getRevenueSeries(unitId, today)),
    optional(getQuoteConversion(unitId, today)),
    // Metas: só a gestão lê. Funil e CRC: só recepção e gestão (como no menu).
    optional(manager ? getRevenueGoal(unitId, today) : null),
    optional(isDentist ? null : getFunnel(`${month}-01`, today)),
    optional(isDentist ? null : getRecoveryQueues(today)),
  ]);

  const goalValue = goal?.ok ? goal.value : null;
  const pace = revenue?.ok ? revenuePace(revenue.value.daily, today, goalValue) : null;
  const noShowRate = metrics.past_appointments_30d ? metrics.no_show_30d / metrics.past_appointments_30d : 0;
  const stalledQuotes = recovery?.ok ? recovery.value.stalledQuotes : null;
  const unconfirmedTomorrow = trend?.ok ? trend.value.unconfirmedTomorrow : 0;

  const summary = daySummary({
    paceDelta: pace?.paceDelta ?? null,
    unconfirmedTomorrow,
    stalledQuotes,
    noShowRate,
    pastAppointments: metrics.past_appointments_30d,
  });
  const summaryActions = [
    unconfirmedTomorrow > 0 ? { href: `/agenda?data=${addDays(today, 1)}`, label: "Confirmar amanhã" } : null,
    stalledQuotes ? { href: "/crc?fila=open_quotes", label: "Abrir orçamentos parados", primary: true } : null,
  ].filter((a) => a !== null);

  const revenueChange = revenue?.ok && pace ? relativeChange(pace.total, revenue.value.previous) : null;
  const conversionDelta = conversion?.ok && conversion.value.rate !== null && conversion.value.previousRate !== null ? conversion.value.rate - conversion.value.previousRate : null;
  const overdue = metrics.receivable_overdue_cents;
  const noShowToday = trend?.ok ? trend.value.noShowToday : 0;

  const kpis: Kpi[] = [
    {
      label: "Consultas hoje",
      value: String(metrics.appointments_today),
      href: "/agenda",
      context: [`${metrics.appointments_today_done} atendidas ou em atendimento`, noShowToday ? `${noShowToday} ${noShowToday === 1 ? "falta" : "faltas"}` : null].filter(Boolean).join(" · "),
      trend: trend?.ok ? trend.value.perDay : undefined,
    },
    {
      label: isDentist ? "Recebido no mês (seus)" : "Recebido no mês",
      value: formatCurrencyWhole(metrics.revenue_month_cents),
      href: "/financeiro?status=pagos",
      delta: revenueChange !== null ? { text: signedPercent.format(revenueChange), tone: revenueChange >= 0 ? "up" : "down" } : null,
      context: revenueChange !== null ? `vs. mesmo período de ${monthName(prevMonth)}` : "pagamentos recebidos",
      trend: pace && pace.accumulated.length > 1 ? pace.accumulated : undefined,
    },
    {
      label: "A receber",
      value: formatCurrencyWhole(metrics.receivable_open_cents + overdue),
      href: "/financeiro",
      delta: overdue ? { text: `${formatCurrencyWhole(overdue)} vencido`, tone: "down" } : null,
      context: overdue ? "em aberto e vencido" : "nada vencido",
    },
    {
      label: "Conversão de orçamentos",
      value: conversion?.ok && conversion.value.rate !== null ? percent.format(conversion.value.rate) : "—",
      href: "/orcamentos",
      delta:
        conversionDelta !== null
          ? { text: `${conversionDelta > 0 ? "+" : ""}${Math.round(conversionDelta * 100)} p.p.`, tone: conversionDelta > 0 ? "up" : conversionDelta < 0 ? "down" : "flat" }
          : null,
      context: conversion?.ok
        ? conversion.value.issued
          ? `${conversion.value.approved} de ${conversion.value.issued} aprovados em ${monthName(month)}`
          : `nenhum orçamento apresentado em ${monthName(month)}`
        : "não foi possível calcular",
    },
  ];

  const firstName = session.user.fullName?.split(" ")[0];
  const dateLine = `${formatLongDate(today).replace(/^./, (c) => c.toUpperCase())} · ${now.time}${multiUnit ? ` · ${consolidated ? "todas as unidades" : session.activeUnit?.name}` : ""}`;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="text-[0.8125rem] text-muted-foreground">{dateLine}</p>
          <h1 className="type-display">{firstName ? `${greeting(Math.floor(now.minutes / 60))}, ${firstName}` : "Painel"}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {multiUnit && manager ? (
            <nav className="inline-flex rounded-lg bg-muted p-1" aria-label="Escopo dos indicadores">
              {[
                { href: "/painel", label: "Consolidado", active: consolidated },
                { href: "/painel?escopo=unidade", label: "Unidade atual", active: !consolidated },
              ].map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  aria-current={t.active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-8 items-center rounded-md px-3 text-sm font-medium pointer-coarse:h-11",
                    t.active ? "bg-background shadow-segment" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                </Link>
              ))}
            </nav>
          ) : null}
          <Link href="/pacientes/novo" className={buttonVariants({ variant: "outline" })}>
            Novo paciente
          </Link>
          <Link href="/agenda" className={buttonVariants()}>
            <Plus aria-hidden />
            Nova consulta
          </Link>
        </div>
      </header>

      <DaySummaryBanner summary={summary} actions={summaryActions} />

      <KpiStrip items={kpis} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
        <DashboardCard
          id="faturamento"
          title={`Faturamento de ${monthName(month)}`}
          description={
            goalValue
              ? `Recebido acumulado contra o ritmo necessário para a meta de ${formatCurrency(goalValue)}`
              : isDentist
                ? "Seus pagamentos recebidos, acumulados no mês"
                : "Recebido acumulado no mês e projeção até o fim"
          }
        >
          {pace ? <RevenueChart pace={pace} month={month} canSetGoal={manager && goal?.ok === true} /> : <BlockError what="o faturamento" />}
        </DashboardCard>

        <DashboardCard id="hoje" title="Hoje na clínica" link={{ href: "/agenda", label: "Abrir agenda" }}>
          <TodayTimeline appointments={todayList} nowTime={now.time} nowMinutes={now.minutes} />
        </DashboardCard>
      </div>

      {funnel || recovery ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {funnel ? (
            <DashboardCard id="funil" title="Do primeiro contato ao tratamento fechado" description={`Leads de ${monthName(month)}, todas as origens`} link={{ href: "/crm", label: "Abrir CRM" }}>
              {funnel.ok ? <FunnelBars steps={funnel.value} /> : <BlockError what="o funil" />}
            </DashboardCard>
          ) : null}
          {recovery ? (
            <DashboardCard id="recuperar" title="Para recuperar" link={{ href: "/crc", label: "Abrir CRC" }}>
              {recovery.ok ? <RecoveryList queues={recovery.value.queues} /> : <BlockError what="as filas da CRC" />}
            </DashboardCard>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
