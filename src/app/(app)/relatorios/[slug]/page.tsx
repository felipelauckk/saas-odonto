import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download, FileSpreadsheet } from "lucide-react";

import { KpiStrip } from "@/components/app/kpi-strip";
import { EmptyState } from "@/components/feedback/empty-state";
import { SubpageHeader } from "@/components/layout/subpage-header";
import { buttonVariants } from "@/components/ui/button";
import { PeriodFilter } from "@/features/payables/components/period-filter";
import { reportBySlug } from "@/features/reports/catalog";
import { filtersToQuery, parseReportFilters } from "@/features/reports/filters";
import { ReportBars } from "@/features/reports/components/report-ui";
import { ReportSwitcher } from "@/features/reports/components/report-switcher";
import { formatCell } from "@/features/reports/format";
import { reportInsight } from "@/features/reports/insight";
import { runReport } from "@/features/reports/run";
import { requireManager } from "@/features/tenancy/guards";
import { todayIso } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/relatorios/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: reportBySlug.get(slug)?.title ?? "Relatório" };
}

export default async function Page({ params, searchParams }: PageProps<"/relatorios/[slug]">) {
  const session = await requireManager();
  const { slug } = await params;
  const def = reportBySlug.get(slug);
  if (!def) notFound();
  const filters = parseReportFilters(def, await searchParams, todayIso());
  const supabase = await createClient();
  const [result, { data: pros }] = await Promise.all([
    runReport(slug, filters),
    def.filters.includes("professional")
      ? supabase.from("professionals").select("id, name").eq("active", true).order("name")
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  if (!result) notFound();

  const selects = [
    ...(def.filters.includes("groupBy") && def.groupBy ? [{ name: "agrupar", label: "Agrupar por", value: filters.groupBy, options: def.groupBy }] : []),
    ...(def.filters.includes("unit") && session.units.length > 1
      ? [
          {
            name: "unidade",
            label: "Unidade",
            value: filters.unitId ?? "",
            options: [{ value: "", label: "Todas" }, ...session.units.map((u) => ({ value: u.id, label: u.name }))],
          },
        ]
      : []),
    ...(def.filters.includes("professional")
      ? [
          {
            name: "profissional",
            label: "Profissional",
            value: filters.professionalId ?? "",
            options: [{ value: "", label: "Todos" }, ...(pros ?? []).map((p) => ({ value: p.id, label: p.name }))],
          },
        ]
      : []),
    ...(def.filters.includes("months")
      ? [
          {
            name: "meses",
            label: "Sem visita há mais de",
            value: String(filters.months),
            options: [3, 6, 12, 18, 24].map((m) => ({ value: String(m), label: `${m} meses` })),
          },
        ]
      : []),
  ];
  const query = filtersToQuery(def, filters);
  const insight = reportInsight(result);
  const num = (type: string) => (type === "text" || type === "date" ? "" : "text-right tabular-nums");

  return (
    <div className="space-y-6">
      <SubpageHeader
        title={def.title}
        description={def.description}
        backHref="/relatorios"
        backLabel="Relatórios"
        actions={
          <div className="flex flex-wrap gap-2">
            <ReportSwitcher current={slug} />
            <a href={`/relatorios/${slug}/exportar?formato=xlsx&${query}`} className={buttonVariants({ variant: "outline" })}>
              <FileSpreadsheet aria-hidden />
              Excel
            </a>
            <a href={`/relatorios/${slug}/exportar?formato=csv&${query}`} className={buttonVariants({ variant: "outline" })}>
              <Download aria-hidden />
              CSV
            </a>
          </div>
        }
      />
      <PeriodFilter
        fields={
          def.filters.includes("period")
            ? [
                { name: "de", label: "De", type: "date", value: filters.from },
                { name: "ate", label: "Até", type: "date", value: filters.to },
              ]
            : []
        }
        selects={selects}
      />

      {result.summary?.length ? (
        <KpiStrip
          label="Resumo do relatório"
          className="lg:grid-cols-2 2xl:grid-cols-4 [&_.type-kpi]:text-2xl"
          items={result.summary.map((sm) => ({ label: sm.label, value: formatCell({ key: "s", label: sm.label, type: sm.type }, sm.value) }))}
        />
      ) : null}

      {insight ? <ReportBars insight={insight} /> : null}

      {result.rows.length ? (
        <div className="overflow-x-auto rounded-card border bg-card" tabIndex={0} role="region" aria-label={`Tabela: ${def.title}`}>
          <table className="w-full text-sm">
            <thead className="border-b border-border-soft text-left text-muted-foreground">
              <tr>
                {result.columns.map((c) => (
                  <th key={c.key} scope="col" className={`px-4 py-3 type-label whitespace-nowrap ${num(c.type)}`}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft">
              {result.rows.map((row, i) => (
                <tr key={i}>
                  {result.columns.map((c) => (
                    <td key={c.key} className={`px-4 py-2.5 ${num(c.type)}`}>
                      {formatCell(c, row[c.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {result.total ? (
              <tfoot className="border-t font-semibold">
                <tr>
                  {result.columns.map((c) => (
                    <td key={c.key} className={`px-4 py-2.5 ${num(c.type)}`}>
                      {result.total![c.key] === null || result.total![c.key] === undefined ? "" : formatCell(c, result.total![c.key])}
                    </td>
                  ))}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      ) : (
        <EmptyState icon={FileSpreadsheet} title="Nada para mostrar" description="Nenhum dado com esses filtros." />
      )}
      {result.note ? <p className="text-xs text-muted-foreground">{result.note}</p> : null}
    </div>
  );
}
