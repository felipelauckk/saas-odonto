import type { ReactNode } from "react";
import { cn } from "cn";

import { Sparkline } from "./sparkline";

export type Kpi = {
  label: string;
  value: ReactNode;
  /** Variação já formatada (ex.: "+12%"); o tom diz se é melhora ou piora. */
  delta?: { text: string; tone: "up" | "down" | "flat" };
  trend?: readonly number[];
  context?: ReactNode;
};

const DELTA = { up: "text-success", down: "text-destructive", flat: "text-muted-foreground" } as const;

/** Indicadores numa única faixa com divisórias, não cartões soltos. */
export function KpiStrip({ items, className }: { items: readonly Kpi[]; className?: string }) {
  return (
    <dl
      className={cn(
        // Divisórias de 1px: o fundo da grade aparece entre as células.
        "grid gap-px overflow-hidden rounded-card border border-border bg-border-soft sm:grid-cols-2",
        items.length >= 4 ? "lg:grid-cols-4" : items.length === 3 ? "lg:grid-cols-3" : "",
        "sm:[&>div:last-child:nth-child(odd)]:col-span-2 lg:[&>div:last-child:nth-child(odd)]:col-span-1",
        className,
      )}
    >
      {items.map((k) => (
        <div key={k.label} className="flex flex-col gap-2 bg-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <dt className="type-label text-muted-foreground">{k.label}</dt>
            {k.delta ? <span className={cn("text-xs font-semibold tabular-nums", DELTA[k.delta.tone])}>{k.delta.text}</span> : null}
          </div>
          <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
            <dd className="type-kpi whitespace-nowrap">{k.value}</dd>
            {k.trend ? <Sparkline values={k.trend} /> : null}
          </div>
          {k.context ? <p className="text-[0.8125rem] text-muted-foreground">{k.context}</p> : null}
        </div>
      ))}
    </dl>
  );
}
