import type { Metadata } from "next";
import Link from "next/link";
import { Plus, SearchX, Users } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { PatientFilters } from "@/features/patients/components/patient-filters";
import { Pagination, PatientsList } from "@/features/patients/components/patients-list";
import { hasAnyPatient, searchPatients } from "@/features/patients/queries";
import { patientFiltersSchema } from "@/features/patients/schemas";
import { requireClinic } from "@/features/tenancy/guards";

export const metadata: Metadata = { title: "Pacientes" };

export default async function Page({ searchParams }: PageProps<"/pacientes">) {
  await requireClinic();
  const raw = await searchParams;
  const filters = patientFiltersSchema.parse({
    q: typeof raw.q === "string" ? raw.q : "",
    status: raw.status,
    source: raw.source ?? null,
    page: raw.page ?? 1,
  });
  const { patients, total, pages } = await searchPatients(filters);
  const filtering = Boolean(filters.q || filters.source || filters.status === "archived");
  // Tela de "primeiro paciente" só quando não existe nenhum, nem arquivado.
  const isEmptyClinic = !filtering && total === 0 && !(await hasAnyPatient());

  const hrefFor = (page: number) => {
    const qs = new URLSearchParams();
    if (filters.q) qs.set("q", filters.q);
    if (filters.status === "archived") qs.set("status", "archived");
    if (filters.source) qs.set("source", filters.source);
    if (page > 1) qs.set("page", String(page));
    const s = qs.toString();
    return s ? `/pacientes?${s}` : "/pacientes";
  };

  const newButton = (
    <Link href="/pacientes/novo" className={buttonVariants()}>
      <Plus aria-hidden />
      Novo paciente
    </Link>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Pacientes" description="Cadastro e ficha dos pacientes." actions={newButton} />
      {isEmptyClinic ? (
        <EmptyState
          icon={Users}
          title="Nenhum paciente por enquanto"
          description="Cadastre o primeiro paciente da clínica."
          action={newButton}
        />
      ) : (
        <>
          <PatientFilters />
          {patients.length ? (
            <>
              <PatientsList patients={patients} />
              <Pagination page={filters.page} pages={pages} total={total} hrefFor={hrefFor} />
            </>
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
