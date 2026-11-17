import Link from "next/link";
import { cn } from "cn";

import { formatCurrency, formatCurrencyWhole } from "@/lib/format";

import { shortMoney, type DueUrgency, type MonthFlow } from "../overview";

const monthShort = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" });
const monthLong = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const label = (month: string) => monthShort.format(new Date(`${month}T12:00:00Z`)).replace(".", "");

/** Entradas e saídas de cada mês lado a lado, com o resultado escrito acima. */
export function MonthBars({ months }: { months: MonthFlow[] }) {
  const max = Math.max(1, ...months.flatMap((m) => [m.inCents, m.outCents]));
  return (
    <figure className="space-y-3">
      <div className="flex h-56 items-end gap-2 sm:gap-4" aria-hidden>
        {months.map((m) => (
          <div key={m.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
            <span className={cn("text-[0.6875rem] font-semibold whitespace-nowrap tabular-nums", m.resultCents >= 0 ? "text-success" : "text-destructive")}>
              {m.inCents || m.outCents ? shortMoney(m.resultCents) : "—"}
            </span>
            <div className="flex w-full flex-1 items-end justify-center gap-[2px]">
              <span
                title={`Entradas em ${label(m.month)}: ${formatCurrency(m.inCents)}`}
                className={cn("w-full max-w-7 rounded-t-[4px]", m.partial ? "bg-primary/45" : "bg-primary")}
                style={{ height: `${(m.inCents / max) * 100}%`, minHeight: m.inCents ? 2 : 0 }}
              />
              <span
                title={`Saídas em ${label(m.month)}: ${formatCurrency(m.outCents)}`}
                className={cn("w-full max-w-7 rounded-t-[4px]", m.partial ? "bg-chart-5/40" : "bg-chart-5/70")}
                style={{ height: `${(m.outCents / max) * 100}%`, minHeight: m.outCents ? 2 : 0 }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 border-t border-border-soft pt-2 sm:gap-4" aria-hidden>
        {months.map((m) => (
          <span key={m.month} className="flex-1 text-center text-xs text-muted-foreground">
            {label(m.month)}
            {m.partial ? "*" : ""}
          </span>
        ))}
      </div>
      <figcaption className="sr-only">
        <table>
          <caption>Entradas e saídas por mês</caption>
          <thead>
            <tr>
              <th scope="col">Mês</th>
              <th scope="col">Entradas</th>
              <th scope="col">Saídas</th>
              <th scope="col">Resultado</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.month}>
                <th scope="row">
                  {monthLong.format(new Date(`${m.month}T12:00:00Z`))}
                  {m.partial ? " (até hoje)" : ""}
                </th>
                <td>{formatCurrency(m.inCents)}</td>
                <td>{formatCurrency(m.outCents)}</td>
                <td>{formatCurrency(m.resultCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}

export function ChartLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legenda">
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="size-2.5 rounded-sm bg-primary" />
        Entradas
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="size-2.5 rounded-sm bg-chart-5/70" />
        Saídas
      </li>
    </ul>
  );
}

const URGENCY: Record<DueUrgency, { dot: string; text: string; sr: string }> = {
  late: { dot: "bg-destructive", text: "text-destructive font-semibold", sr: "vencido" },
  soon: { dot: "bg-warning", text: "", sr: "vence em breve" },
  ok: { dot: "bg-input", text: "", sr: "" },
};

export type DueRow = { id: string; date: string; dateLabel: string; urgency: DueUrgency; who: string; what: string; amountCents: number };

/** Lista curta de vencimentos (a receber ou a pagar) com o total do período. */
export function DueList({ title, total, count, rows, href, empty }: { title: string; total: number; count: number; rows: DueRow[]; href: string; empty: string }) {
  const id = `due-${href.replace(/\W/g, "")}`;
  return (
    <section aria-labelledby={id} className="space-y-3 rounded-card border bg-card p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={id} className="type-section">
          {title}
        </h2>
        <span className="text-sm font-semibold tabular-nums">{formatCurrencyWhole(total)}</span>
      </div>
      {rows.length ? (
        <ul className="divide-y divide-border-soft">
          {rows.map((r) => (
            <li key={r.id} className="grid grid-cols-[0.5rem_minmax(3rem,auto)_minmax(0,1fr)_auto] items-center gap-3 py-2.5">
              <span aria-hidden className={cn("size-2 rounded-full", URGENCY[r.urgency].dot)} />
              <span className={cn("text-xs tabular-nums", URGENCY[r.urgency].text)}>
                {r.dateLabel}
                {URGENCY[r.urgency].sr ? <span className="sr-only">, {URGENCY[r.urgency].sr}</span> : null}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[0.8125rem] font-medium">{r.who}</span>
                <span className="truncate text-xs text-muted-foreground">{r.what}</span>
              </span>
              <span className="text-[0.8125rem] font-semibold tabular-nums">{formatCurrencyWhole(r.amountCents)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-4 text-center text-[0.8125rem] text-muted-foreground">{empty}</p>
      )}
      {count > rows.length ? (
        <Link href={href} className="inline-flex text-[0.8125rem] font-medium text-primary hover:text-primary-hover pointer-coarse:min-h-11 pointer-coarse:items-center">
          Ver todos ({count})
        </Link>
      ) : null}
    </section>
  );
}
