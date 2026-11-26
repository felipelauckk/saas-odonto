import type { Metadata } from "next";
import Link from "next/link";
import { ChartLine, ChevronRight, LayoutDashboard } from "lucide-react";

import { AskForm, ReportNav } from "@/features/reports/components/report-ui";
import { requireManager } from "@/features/tenancy/guards";
import { isAiConfigured } from "@/lib/ai/claude";

export const metadata: Metadata = { title: "Relatórios" };

const PANELS = [
  { href: "/analitico", title: "Painel analítico e metas", description: "Evolução mês a mês, metas, funil e rankings", icon: ChartLine },
  { href: "/financeiro/visao-geral", title: "Visão geral do financeiro", description: "Saldo, a receber e a pagar num só lugar", icon: LayoutDashboard },
];

export default async function Page() {
  await requireManager();
  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h1 className="type-display">Relatórios</h1>
          <p className="text-sm text-muted-foreground">Escolha um relatório. Todos têm filtros e exportação para Excel e CSV.</p>
        </div>
        {isAiConfigured() ? <AskForm /> : null}
      </header>

      <ReportNav />

      <section aria-labelledby="paineis" className="space-y-2.5">
        <h2 id="paineis" className="type-label text-muted-foreground">
          Painéis com gráficos
        </h2>
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {PANELS.map(({ href, title, description, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="group flex h-full items-center gap-3.5 rounded-card border bg-card p-4 shadow-card outline-none transition-colors hover:border-primary/40 hover:bg-accent/30 focus-visible:ring-3 focus-visible:ring-ring/40"
              >
                <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Icon className="size-[1.125rem]" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-semibold">{title}</span>
                  <span className="text-[0.8125rem] text-muted-foreground">{description}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
