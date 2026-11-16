import Link from "next/link";
import { cn } from "cn";

import { formatCurrency, formatCurrencyWhole } from "@/lib/format";

import { niceTicks, type RevenuePace } from "../logic";

const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const monthShort = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" });
const weekdayLong = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "UTC" });

function axisLabel(cents: number) {
  return cents === 0 ? "0" : compact.format(cents / 100);
}

function dayLabel(month: string, day: number) {
  const date = new Date(`${month}-${String(day).padStart(2, "0")}T00:00:00Z`);
  return `${day} ${monthShort.format(date).replace(".", "")}`;
}

function bestDayLabel(month: string, day: number) {
  const date = new Date(`${month}-${String(day).padStart(2, "0")}T00:00:00Z`);
  return `${weekdayLong.format(date).replace("-feira", "")}, ${dayLabel(month, day)}`;
}

type RevenueChartProps = {
  pace: RevenuePace;
  /** "AAAA-MM" do mês mostrado. */
  month: string;
  /** Mostra o link para definir a meta (só a gestão define metas). */
  canSetGoal: boolean;
};

/**
 * Recebido acumulado no mês contra o ritmo da meta, com a projeção até o fim do
 * mês. Linhas em SVG esticado; textos e marcador em HTML para não distorcerem.
 */
export function RevenueChart({ pace, month, canSetGoal }: RevenueChartProps) {
  const ticks = niceTicks(Math.max(pace.total, pace.goal ?? 0, pace.projection ?? 0));
  const top = ticks[ticks.length - 1]!;
  const x = (day: number) => ((day - 1) / Math.max(1, pace.lastDay - 1)) * 100;
  const y = (v: number) => 100 - (v / top) * 100;

  const points = pace.accumulated.map((v, i) => `${x(i + 1).toFixed(2)} ${y(v).toFixed(2)}`);
  const line = points.length ? `M${points.join(" L")}` : "";
  const todayX = x(pace.today);
  const todayY = y(pace.total);
  const area = line ? `${line} L${todayX.toFixed(2)} 100 L0 100 Z` : "";
  const labelLeft = todayX > 50;

  const summary = [
    `Recebido até hoje, dia ${pace.today}: ${formatCurrency(pace.total)}`,
    pace.goal ? `meta do mês: ${formatCurrency(pace.goal)}` : null,
    pace.projection !== null ? `projeção: ${formatCurrency(pace.projection)}` : null,
  ]
    .filter(Boolean)
    .join("; ");

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legenda">
        <li className="flex items-center gap-1.5">
          <span className="h-[3px] w-3.5 rounded-full bg-primary" aria-hidden />
          Recebido
        </li>
        <li className="flex items-center gap-1.5">
          <span className="w-3.5 border-t-2 border-dotted border-primary" aria-hidden />
          Projeção
        </li>
        {pace.goal ? (
          <li className="flex items-center gap-1.5">
            <span className="w-3.5 border-t-2 border-dashed border-warning" aria-hidden />
            Ritmo da meta
          </li>
        ) : null}
      </ul>

      <figure className="m-0 grid grid-cols-[auto_1fr] gap-x-2">
        <div className="relative h-52 w-12 sm:h-60" aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2 text-[0.6875rem] text-muted-foreground tabular-nums" style={{ top: `${y(t)}%` }}>
              {axisLabel(t)}
            </span>
          ))}
        </div>
        <div className="relative h-52 sm:h-60">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
            {ticks.map((t) => (
              <line key={t} x1="0" x2="100" y1={y(t)} y2={y(t)} className="stroke-border-soft" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            ))}
            {area ? <path d={area} className="fill-primary/8" /> : null}
            {pace.goal ? (
              <line x1="0" y1="100" x2="100" y2={y(pace.goal)} className="stroke-warning" strokeWidth="1.5" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />
            ) : null}
            {pace.projection !== null && pace.today < pace.lastDay ? (
              <line
                x1={todayX}
                y1={todayY}
                x2="100"
                y2={y(pace.projection)}
                className="stroke-primary/60"
                strokeWidth="2"
                strokeDasharray="2 4"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
            {line ? (
              <path d={line} fill="none" className="stroke-primary" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            ) : null}
            <line x1={todayX} x2={todayX} y1="0" y2="100" className="stroke-foreground/25" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          </svg>
          <span
            className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] border-primary bg-card"
            style={{ left: `${todayX}%`, top: `${todayY}%` }}
            aria-hidden
          />
          <div
            className={cn(
              "absolute rounded-lg bg-foreground px-3 py-2 text-background shadow-sm",
              labelLeft ? "-translate-x-[calc(100%+0.75rem)]" : "translate-x-3",
            )}
            style={{ left: `${todayX}%`, top: `max(0px, calc(${todayY}% - 4rem))` }}
            aria-hidden
          >
            <p className="text-[0.6875rem] opacity-75">Hoje, dia {pace.today}</p>
            <p className="text-sm font-semibold whitespace-nowrap tabular-nums">{formatCurrencyWhole(pace.total)}</p>
          </div>
        </div>
        <div />
        <div className="mt-2 flex justify-between text-[0.6875rem] text-muted-foreground" aria-hidden>
          <span>{dayLabel(month, 1)}</span>
          <span>{dayLabel(month, pace.lastDay)}</span>
        </div>
        <figcaption className="sr-only">{summary}</figcaption>
      </figure>

      <dl className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border-soft pt-3 text-[0.8125rem]">
        <div className="flex gap-1.5">
          <dt className="text-muted-foreground">Projeção do mês</dt>
          <dd className="font-semibold tabular-nums">{pace.projection !== null ? formatCurrencyWhole(pace.projection) : "—"}</dd>
        </div>
        {pace.requiredPerDay !== null ? (
          <div className="flex gap-1.5">
            <dt className="text-muted-foreground">Ritmo necessário</dt>
            <dd className="font-semibold tabular-nums">{formatCurrencyWhole(pace.requiredPerDay)}/dia útil</dd>
          </div>
        ) : null}
        {pace.bestDay !== null ? (
          <div className="flex gap-1.5">
            <dt className="text-muted-foreground">Melhor dia</dt>
            <dd className="font-semibold">{bestDayLabel(month, pace.bestDay)}</dd>
          </div>
        ) : null}
        {!pace.goal && canSetGoal ? (
          <div className="ml-auto">
            <Link href="/analitico/metas" className="font-semibold text-primary hover:text-primary-hover pointer-coarse:inline-flex pointer-coarse:h-11 pointer-coarse:items-center">
              Definir meta do mês
            </Link>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
