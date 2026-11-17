import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { AskForm, ReportNav } from "@/features/reports/components/report-ui";
import { requireManager } from "@/features/tenancy/guards";

export const metadata: Metadata = { title: "Relatórios" };

export default async function Page() {
  await requireManager();
  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h1 className="type-display">Relatórios</h1>
          <p className="text-sm text-muted-foreground">Todos com filtros e exportação para Excel e CSV.</p>
        </div>
        <AskForm />
      </header>
      <Link
        href="/analitico"
        className="flex items-center gap-4 rounded-card border border-primary/30 bg-accent/50 p-5 outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="min-w-0 flex-1 space-y-1">
          <span className="block type-section">Painel analítico e metas</span>
          <span className="block text-sm text-muted-foreground">Evolução mensal, metas versus realizado, funil de captação, ocupação e rankings.</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
      <ReportNav columns />
    </div>
  );
}
