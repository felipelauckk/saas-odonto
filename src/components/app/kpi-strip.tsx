import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "cn";

import { Sparkline } from "./sparkline";

export type KpiTint = "sky" | "mint" | "lilac" | "peach" | "rose";

export type Kpi = {
  label: string;
  value: ReactNode;
  /** Variação já formatada (ex.: "+12%"); o tom diz se é melhora ou piora. */
  delta?: { text: string; tone: "up" | "down" | "flat" } | null;
  trend?: readonly number[];
  context?: ReactNode;
  /** Torna o indicador um link para a tela de detalhe. */
  href?: string;
  /** Ícone pequeno ao lado do rótulo, num quadrado no tom pastel. */
  icon?: LucideIcon;
  tint?: KpiTint;
  /** O número mais importante da tela: cartão com degradê. Um por tela. */
  highlight?: boolean;
};

const DELTA = { up: "text-success", down: "text-destructive", flat: "text-muted-foreground" } as const;

const TINT: Record<KpiTint, string> = {
  sky: "bg-tint-sky text-tint-sky-foreground",
  mint: "bg-tint-mint text-tint-mint-foreground",
  lilac: "bg-tint-lilac text-tint-lilac-foreground",
  peach: "bg-tint-peach text-tint-peach-foreground",
  rose: "bg-tint-rose text-tint-rose-foreground",
};

function KpiBody({ k }: { k: Kpi }) {
  const Icon = k.icon;
  const hero = k.highlight;
  return (
    <>
      <span className={cn("flex min-w-0 items-center gap-2.5 text-[0.8125rem] font-semibold", hero ? "text-white/90" : "text-muted-foreground")}>
        {Icon ? (
          <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", hero ? "bg-white/18 text-white" : TINT[k.tint ?? "sky"])} aria-hidden>
            <Icon className="size-3.5" strokeWidth={2} />
          </span>
        ) : null}
        <span className="min-w-0">{k.label}</span>
      </span>
      <span className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
        <span className={cn("type-kpi whitespace-nowrap", hero && "font-black")}>{k.value}</span>
        {k.trend ? <Sparkline values={k.trend} className={cn(hero && "text-white")} /> : null}
      </span>
      {k.delta || k.context ? (
        <span className={cn("text-[0.8125rem]", hero ? "text-white/90" : "text-muted-foreground")}>
          {k.delta ? (
            <span className={cn("font-semibold tabular-nums", hero ? "text-white" : DELTA[k.delta.tone])}>
              {k.delta.text}
              {k.context ? " · " : null}
            </span>
          ) : null}
          {k.context}
        </span>
      ) : null}
    </>
  );
}

/** Indicadores em cartões brancos; o de destaque (se houver) ganha o degradê da marca. */
export function KpiStrip({ items, className, label = "Indicadores" }: { items: readonly Kpi[]; className?: string; label?: string }) {
  const hasHero = items.some((k) => k.highlight);
  const cols = items.length;
  return (
    <ul
      aria-label={label}
      className={cn(
        "grid gap-4 sm:grid-cols-2",
        cols >= 4 ? "lg:grid-cols-4" : cols === 3 ? "lg:grid-cols-3" : "",
        // Sobra um cartão sozinho na última linha do tablet? Ele ocupa a linha toda (o destaque já ocupa uma).
        hasHero
          ? "sm:[&>li:last-child:nth-child(even)]:col-span-2 lg:[&>li:last-child:nth-child(even)]:col-span-1"
          : "sm:[&>li:last-child:nth-child(odd)]:col-span-2 lg:[&>li:last-child:nth-child(odd)]:col-span-1",
        className,
      )}
    >
      {items.map((k) => {
        const cell = cn(
          "flex h-full flex-1 flex-col justify-between gap-3 rounded-card p-5",
          k.highlight ? "bg-hero text-white shadow-card" : "border bg-card shadow-card",
        );
        return (
          // No celular e no tablet o destaque ocupa a linha toda; no computador, uma coluna como os outros.
          <li key={k.label} className={cn("flex min-w-0", k.highlight && "sm:col-span-2 lg:col-span-1")}>
            {k.href ? (
              <Link
                href={k.href}
                className={cn(
                  cell,
                  "outline-none transition-[box-shadow,transform] hover:-translate-y-px focus-visible:ring-3 focus-visible:ring-ring/50",
                  !k.highlight && "hover:border-input",
                )}
              >
                <KpiBody k={k} />
              </Link>
            ) : (
              <div className={cell}>
                <KpiBody k={k} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
