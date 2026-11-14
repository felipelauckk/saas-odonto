import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { cn } from "cn";

import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { AppointmentStatusBadge } from "@/features/agenda/components/status-badge";
import { getDashboardMetrics, getTodayAppointments } from "@/features/dashboard/queries";
import { requireClinic } from "@/features/tenancy/guards";
import { canManageClinic } from "@/features/tenancy/roles";
import { todayIso } from "@/lib/dates";
import { formatCurrency } from "@/lib/format";
import { formatLongDate, utcToZoned } from "@/lib/timezone";

export const metadata: Metadata = { title: "Painel" };

const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });

function Metric({ label, value, detail, href, tone }: { label: string; value: string; detail?: string; href?: string; tone?: "danger" }) {
  const body = (
    <>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={cn("text-2xl font-semibold tracking-tight tabular-nums", tone === "danger" && "text-destructive")}>{value}</dd>
      {detail ? <dd className="text-xs text-muted-foreground">{detail}</dd> : null}
    </>
  );
  return href ? (
    <Link href={href} className="block rounded-xl border p-4 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50">
      {body}
    </Link>
  ) : (
    <div className="rounded-xl border p-4">{body}</div>
  );
}

export default async function Page({ searchParams }: PageProps<"/painel">) {
  const session = await requireClinic();
  const { escopo } = await searchParams;
  const manager = canManageClinic(session.clinic.role);
  const multiUnit = session.units.length > 1;
  // Gestão vê o consolidado por padrão quando há mais de uma unidade.
  const consolidated = multiUnit && manager && escopo !== "unidade";
  const unitId = multiUnit && !consolidated ? (session.activeUnit?.id ?? null) : null;

  const [metrics, today] = await Promise.all([getDashboardMetrics(unitId), getTodayAppointments(unitId)]);
  const noShowRate = metrics.past_appointments_30d ? metrics.no_show_30d / metrics.past_appointments_30d : 0;
  const isDentist = session.clinic.role === "dentist";
  const firstName = session.user.fullName?.split(" ")[0];

  return (
    <div className="space-y-8">
      <PageHeader
        title={firstName ? `Olá, ${firstName}` : "Painel"}
        description={`${formatLongDate(todayIso()).replace(/^./, (c) => c.toUpperCase())}${multiUnit ? ` · ${consolidated ? "todas as unidades" : session.activeUnit?.name}` : ""}`}
        actions={
          multiUnit && manager ? (
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
                    t.active ? "bg-background shadow-xs" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                </Link>
              ))}
            </nav>
          ) : undefined
        }
      />

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric
          label="Consultas hoje"
          value={String(metrics.appointments_today)}
          detail={`${metrics.appointments_today_done} já atendidas ou em atendimento`}
          href="/agenda"
        />
        <Metric label={isDentist ? "Recebido no mês (seus)" : "Faturamento do mês"} value={formatCurrency(metrics.revenue_month_cents)} detail="pagamentos recebidos" href="/financeiro?status=pagos" />
        <Metric
          label="A receber"
          value={formatCurrency(metrics.receivable_open_cents + metrics.receivable_overdue_cents)}
          detail={metrics.receivable_overdue_cents ? `${formatCurrency(metrics.receivable_overdue_cents)} vencido` : "nada vencido"}
          tone={metrics.receivable_overdue_cents ? "danger" : undefined}
          href="/financeiro"
        />
        <Metric label="Orçamentos em aberto" value={String(metrics.open_plans)} detail={formatCurrency(metrics.open_plans_cents)} href="/orcamentos" />
        <Metric
          label="Taxa de faltas"
          value={percent.format(noShowRate)}
          detail={`${metrics.no_show_30d} de ${metrics.past_appointments_30d} nos últimos 30 dias`}
          href="/agenda/faltas"
        />
      </dl>

      <section className="space-y-3" aria-labelledby="hoje">
        <div className="flex items-center justify-between">
          <h2 id="hoje" className="text-base font-medium">
            Agenda de hoje
          </h2>
          <Link href="/agenda" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Abrir agenda
          </Link>
        </div>
        {today.length ? (
          <ul className="divide-y rounded-xl border">
            {today.map((a) => (
              <li key={a.id} className="flex items-center gap-4 px-4 py-3 sm:px-5">
                <span className="w-12 text-sm font-medium tabular-nums">{utcToZoned(a.starts_at).time}</span>
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: a.professionals?.color ?? "#64748b" }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <Link href={`/pacientes/${a.patient_id}`} className="block truncate text-sm font-medium hover:underline">
                    {a.patients?.full_name}
                  </Link>
                  <span className="block truncate text-xs text-muted-foreground">{[a.professionals?.name, a.type].filter(Boolean).join(" · ")}</span>
                </span>
                <AppointmentStatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={CalendarDays} title="Nenhuma consulta hoje" description="As consultas do dia aparecem aqui." />
        )}
      </section>
    </div>
  );
}
