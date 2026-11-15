import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { reports } from "@/features/reports/catalog";
import { requireManager } from "@/features/tenancy/guards";

export const metadata: Metadata = { title: "Relatórios" };

export default async function Page() {
  await requireManager();
  return (
    <div className="space-y-8">
      <PageHeader title="Relatórios" description="Escolha um relatório. Todos têm filtros e exportação para Excel e CSV." />
      <Link href="/analitico" className="flex items-center gap-4 rounded-xl border border-primary/40 bg-accent/40 p-5 outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50">
        <span className="min-w-0 flex-1 space-y-1">
          <span className="block font-medium">Painel analítico e metas</span>
          <span className="block text-sm text-muted-foreground">Evolução mensal, metas versus realizado, funil de captação, ocupação e rankings.</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
      <ul className="grid gap-3 sm:grid-cols-2">
        {reports.map((r) => (
          <li key={r.slug}>
            <Link href={`/relatorios/${r.slug}`} className="flex h-full items-start gap-4 rounded-xl border p-5 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50">
              <span className="min-w-0 flex-1 space-y-1">
                <span className="block font-medium">{r.title}</span>
                <span className="block text-sm text-muted-foreground">{r.description}</span>
              </span>
              <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
