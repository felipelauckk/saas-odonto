import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "cn";

import { Sparkline } from "./sparkline";

export type Kpi = {
  label: string;
  value: ReactNode;
  /** Variação já formatada (ex.: "+12%"); o tom diz se é melhora ou piora. */
  delta?: { text: string; tone: "up" | "down" | "flat" } | null;
  trend?: readonly number[];
  context?: ReactNode;
  /** Torna o indicador um link para a tela de detalhe. */
  href?: string;
};

const DELTA = { up: "text-success", down: "text-destructive", flat: "text-muted-foreground" } as const;

function KpiBody({ k }: { k: Kpi }) {
  return (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className="type-label text-muted-foreground">{k.label}</span>
        {k.delta ? <span className={cn("text-xs font-semibold tabular-nums", DELTA[k.delta.tone])}>{k.delta.text}</span> : null}
      </span>
      <span className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
        <span className="type-kpi whitespace-nowrap">{k.value}</span>
        {k.trend ? <Sparkline values={k.trend} /> : null}
      </span>
      {k.context ? <span className="text-[0.8125rem] text-muted-foreground">{k.context}</span> : null}
    </>
  );
}

/** Indicadores numa única faixa com divisórias, não cartões soltos. */
export function KpiStrip({ items, className, label = "Indicadores" }: { items: readonly Kpi[]; className?: string; label?: string }) {
  const cell = "flex flex-1 flex-col gap-2 p-5 sm:p-6";
  return (
    <ul
      aria-label={label}
      className={cn(
        // Divisórias de 1px: o fundo da grade aparece entre as células.
        "grid gap-px overflow-hidden rounded-card border border-border bg-border-soft sm:grid-cols-2",
        items.length >= 4 ? "lg:grid-cols-4" : items.length === 3 ? "lg:grid-cols-3" : "",
        "sm:[&>li:last-child:nth-child(odd)]:col-span-2 lg:[&>li:last-child:nth-child(odd)]:col-span-1",
        className,
      )}
    >
      {items.map((k) => (
        <li key={k.label} className="flex bg-card">
          {k.href ? (
            <Link
              href={k.href}
              className={cn(cell, "outline-none transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50")}
            >
              <KpiBody k={k} />
            </Link>
          ) : (
            <div className={cell}>
              <KpiBody k={k} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
