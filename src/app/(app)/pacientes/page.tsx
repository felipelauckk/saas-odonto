import type { Metadata } from "next";
import { Activity, CalendarClock, FileText, SearchX, Users } from "lucide-react";

import { KpiStrip, type Kpi } from "@/components/app/kpi-strip";

import { EmptyState } from "@/components/feedback/empty-state";
import { NewPatientSheet } from "@/features/patients/components/new-patient-sheet";
import { PatientFilters } from "@/features/patients/components/patient-filters";
import { Pagination, PatientsList } from "@/features/patients/components/patients-list";
import { PAGE_SIZE } from "@/features/patients/labels";
import { getPatientSources, getSegmentCounts, hasAnyPatient, searchPatients } from "@/features/patients/queries";
import { patientFiltersSchema } from "@/features/patients/schemas";
import { SEGMENTS, segmentFromSlug } from "@/features/patients/situation";
import { requireClinic } from "@/features/tenancy/guards";
import { optional } from "@/lib/optional";

export const metadata: Metadata = { title: "Pacientes" };

const count = new Intl.NumberFormat("pt-BR");

export default async function Page({ searchParams }: PageProps<"/pacientes">) {
  const session = await requireClinic();
  const raw = await searchParams;
  const filters = patientFiltersSchema.parse({
    q: typeof raw.q === "string" ? raw.q : "",
    status: raw.status,
    sourceId: raw.source ?? null,
    segment: segmentFromSlug(raw.situacao),
    page: raw.page ?? 1,
  });
  const [{ patients, total, pages }, counts, sources] = await Promise.all([
    searchPatients(filters),
    optional("pacientes", getSegmentCounts({ q: filters.q, sourceId: filters.sourceId })),
    getPatientSources(),
  ]);
  const filtering = Boolean(filters.q || filters.sourceId || filters.segment || filters.status === "archived");
  // Tela de "primeiro paciente" só quando não existe nenhum, nem arquivado.
  const isEmptyClinic = !filtering && total === 0 && !(await hasAnyPatient());
  // O dentista só enxerga parte das cobranças: o saldo dele sairia errado.
  const showBalance = session.clinic.role !== "dentist";

  const hrefFor = (page: number) => {
    const qs = new URLSearchParams();
    if (filters.q) qs.set("q", filters.q);
    if (filters.status === "archived") qs.set("status", "archived");
    if (filters.segment) qs.set("situacao", SEGMENTS.find((s) => s.value === filters.segment)!.slug);
    if (filters.sourceId) qs.set("source", filters.sourceId);
    if (page > 1) qs.set("page", String(page));
    const s = qs.toString();
    return s ? `/pacientes?${s}` : "/pacientes";
  };

  const newButton = <NewPatientSheet />;

  // Resumo do topo: as mesmas contagens dos filtros rápidos (sem busca nem origem, para não mudar enquanto digita).
  const c = counts.ok ? counts.value : null;
  const kpis: Kpi[] | null =
    c && !filters.q && !filters.sourceId
      ? [
          { label: "Pacientes cadastrados", value: count.format(c.active), icon: Users, highlight: true, context: `${count.format(c.archived)} arquivados`, href: "/pacientes" },
          { label: "Em tratamento", value: count.format(c.in_treatment), icon: Activity, tint: "sky", context: "orçamento aprovado com etapas por fazer", href: "/pacientes?situacao=em-tratamento" },
          { label: "Orçamento em aberto", value: count.format(c.open_quote), icon: FileText, tint: "lilac", context: "apresentado, esperando resposta", href: "/pacientes?situacao=orcamento-aberto" },
          { label: "Retorno vencido", value: count.format(c.return_overdue), icon: CalendarClock, tint: "rose", context: "retorno com data já passada", href: "/pacientes?situacao=retorno-vencido" },
        ]
      : null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="type-display">Pacientes</h1>
          {counts.ok && !isEmptyClinic ? (
            <p className="text-sm text-muted-foreground tabular-nums">
              {counts.value.active === 1 ? "1 cadastrado" : `${count.format(counts.value.active)} cadastrados`}
            </p>
          ) : null}
        </div>
        {newButton}
      </header>
      {isEmptyClinic ? (
        <EmptyState icon={Users} title="Nenhum paciente por enquanto" description="Cadastre o primeiro paciente da clínica." action={newButton} />
      ) : (
        <>
          {kpis ? <KpiStrip items={kpis} label="Resumo dos pacientes" /> : null}
          <PatientFilters counts={counts.ok ? counts.value : null} sources={sources} />
          {patients.length ? (
            <div className="space-y-4">
              <PatientsList patients={patients} showBalance={showBalance} sources={sources} />
              <Pagination page={filters.page} pages={pages} total={total} pageSize={PAGE_SIZE} hrefFor={hrefFor} />
            </div>
          ) : (
            <EmptyState
              icon={SearchX}
              title="Nenhum paciente encontrado"
              description={
                !filtering
                  ? "Todos os pacientes estão arquivados. Veja em Arquivados."
                  : filters.status === "archived" && !filters.q
                    ? "Não há pacientes arquivados."
                    : "Confira o que foi digitado ou mude os filtros."
              }
            />
          )}
        </>
      )}
    </div>
  );
}
