import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Receipt } from "lucide-react";
import { z } from "zod";

import { EmptyState } from "@/components/feedback/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { CashMovementButton } from "@/features/finance/components/cash-movement-button";
import { getCashDay, listActivePaymentMethods } from "@/features/finance/queries";
import { requireClinic } from "@/features/tenancy/guards";
import { todayIso } from "@/lib/dates";
import { formatCurrency } from "@/lib/format";
import { addDays, formatLongDate, utcToZoned } from "@/lib/timezone";

export const metadata: Metadata = { title: "Caixa do dia" };

export default async function Page({ searchParams }: PageProps<"/financeiro/caixa">) {
  const session = await requireClinic();
  if (session.clinic.role === "dentist") redirect("/financeiro");
  const unit = session.activeUnit;
  if (!unit) redirect("/financeiro");

  const { data: raw } = await searchParams;
  const today = todayIso();
  const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(raw).success ? (raw as string) : today;
  const [cash, paymentMethods] = await Promise.all([getCashDay({ unitId: unit.id, date }), listActivePaymentMethods()]);
  const balance = cash.totalIn - cash.totalOut;
  const dayHref = (d: string) => (d === today ? "/financeiro/caixa" : `/financeiro/caixa?data=${d}`);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={dayHref(addDays(date, -1))} className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="Dia anterior">
            <ChevronLeft />
          </Link>
          {date < today ? (
            <Link href={dayHref(addDays(date, 1))} className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="Próximo dia">
              <ChevronRight />
            </Link>
          ) : null}
          <h2 className="text-base font-medium first-letter:uppercase">
            {formatLongDate(date)}
            {session.units.length > 1 ? ` · ${unit.name}` : ""}
          </h2>
        </div>
        {date === today ? <CashMovementButton paymentMethods={paymentMethods} /> : null}
      </div>

      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border p-4">
          <dt className="text-sm text-muted-foreground">Entradas</dt>
          <dd className="text-2xl font-semibold tabular-nums">{formatCurrency(cash.totalIn)}</dd>
        </div>
        <div className="rounded-xl border p-4">
          <dt className="text-sm text-muted-foreground">Saídas</dt>
          <dd className="text-2xl font-semibold tabular-nums">{formatCurrency(cash.totalOut)}</dd>
        </div>
        <div className="rounded-xl border p-4">
          <dt className="text-sm text-muted-foreground">Saldo do dia</dt>
          <dd className={`text-2xl font-semibold tabular-nums ${balance < 0 ? "text-destructive" : ""}`}>{formatCurrency(balance)}</dd>
        </div>
      </dl>

      {cash.byMethod.length ? (
        <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground" aria-label="Saldo por forma de pagamento">
          {cash.byMethod.map(([name, value]) => (
            <li key={name}>
              {name}: <span className="font-medium text-foreground tabular-nums">{formatCurrency(value)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {cash.movements.length ? (
        <ul className="divide-y rounded-xl border">
          {cash.movements.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
              {m.type === "in" ? (
                <ArrowDownLeft className="size-4 shrink-0 text-emerald-600" aria-label="Entrada" />
              ) : (
                <ArrowUpRight className="size-4 shrink-0 text-destructive" aria-label="Saída" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{m.description}</p>
                <p className="text-xs text-muted-foreground">
                  {utcToZoned(m.occurred_at).time}
                  {m.payment_methods?.name ? ` · ${m.payment_methods.name}` : ""}
                </p>
              </div>
              <span className={`text-sm font-medium tabular-nums ${m.type === "out" ? "text-destructive" : ""}`}>
                {m.type === "out" ? "- " : ""}
                {formatCurrency(m.amount_cents)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={Receipt} title="Nenhum movimento neste dia" description="Recebimentos e lançamentos do caixa aparecem aqui." />
      )}
    </div>
  );
}
