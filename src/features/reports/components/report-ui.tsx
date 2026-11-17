import Link from "next/link";
import { Banknote, CalendarDays, ChevronRight, HandCoins, Package, Sparkles, UsersRound, type LucideIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { initials } from "@/lib/initials";

import { REPORT_GROUPS, reportBySlug } from "../catalog";
import { formatCell } from "../format";
import type { Insight } from "../insight";

/** Pergunta em linguagem natural: abre a tela de IA já com a pergunta escrita. */
export function AskForm() {
  return (
    <form action="/analitico/ia" method="get" role="search" className="flex w-full max-w-xl gap-2">
      <label className="relative flex-1">
        <span className="sr-only">Pergunte sobre os dados da clínica</span>
        <Sparkles className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-primary" aria-hidden />
        <input
          name="pergunta"
          type="text"
          required
          minLength={5}
          maxLength={500}
          placeholder="Pergunte: quais pacientes de implante não voltaram este ano?"
          className="h-11 w-full rounded-lg border border-input bg-card pr-3 pl-10 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
        />
      </label>
      <button type="submit" className={buttonVariants({ className: "h-11" })}>
        Perguntar
      </button>
    </form>
  );
}

const GROUP_ICONS: Record<string, LucideIcon> = {
  Dinheiro: Banknote,
  Vendas: HandCoins,
  Agenda: CalendarDays,
  Pacientes: UsersRound,
  "Equipe e materiais": Package,
};

/** Todos os relatórios, em cartões por assunto. */
export function ReportNav() {
  return (
    <nav aria-label="Todos os relatórios" className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      {REPORT_GROUPS.map((g) => {
        const Icon = GROUP_ICONS[g.title] ?? Banknote;
        return (
          <section key={g.title} aria-labelledby={`grupo-${g.title}`} className="rounded-card border bg-card p-2">
            <h2 id={`grupo-${g.title}`} className="flex items-center gap-2.5 px-3 pt-2.5 pb-2 type-section">
              <span aria-hidden className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Icon className="size-4" />
              </span>
              {g.title}
            </h2>
            <ul>
              {g.slugs.map((slug) => {
                const def = reportBySlug.get(slug);
                if (!def) return null;
                return (
                  <li key={slug}>
                    <Link
                      href={`/relatorios/${slug}`}
                      className="group flex items-center gap-3 rounded-lg px-3 py-2.5 outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40"
                    >
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-sm font-semibold">{def.title}</span>
                        <span className="text-xs text-muted-foreground">{def.description}</span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </nav>
  );
}

/** Barras horizontais com a fatia de cada grupo e a conclusão escrita abaixo. */
export function ReportBars({ insight }: { insight: Insight }) {
  const max = insight.bars[0]?.value ?? 1;
  return (
    <section aria-labelledby="leitura" className="space-y-4 rounded-card border bg-card p-4 sm:p-6">
      <h2 id="leitura" className="type-section">
        {insight.valueColumn.label} por {insight.labelColumn.label.toLowerCase()}
      </h2>
      <ul className="space-y-2.5">
        {insight.bars.map((b) => (
          <li key={b.label} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto] items-center gap-3 text-[0.8125rem] sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_7rem]">
            <span className="flex min-w-0 items-center gap-2">
              <span aria-hidden className="hidden size-6 shrink-0 items-center justify-center rounded-avatar bg-accent text-[0.625rem] font-bold text-accent-foreground sm:flex">
                {initials(b.label)}
              </span>
              <span className="truncate font-medium">{b.label}</span>
            </span>
            <span className="flex items-center gap-2">
              <span aria-hidden className="h-2.5 rounded-r-[4px] bg-primary" style={{ width: `${Math.max((b.value / max) * 100, 2)}%` }} />
              <span className="text-xs font-semibold text-muted-foreground tabular-nums">{Math.round(b.share * 100)}%</span>
            </span>
            <span className="text-right font-semibold tabular-nums">{formatCell(insight.valueColumn, b.value)}</span>
          </li>
        ))}
      </ul>
      {insight.others > 0 ? <p className="text-xs text-muted-foreground">Os demais somam {formatCell(insight.valueColumn, insight.others)}.</p> : null}
      <p className="border-t border-border-soft pt-3 text-sm leading-relaxed">{insight.text}</p>
    </section>
  );
}
