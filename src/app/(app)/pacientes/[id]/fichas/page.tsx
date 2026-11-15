import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { z } from "zod";

import { EmptyState } from "@/components/feedback/empty-state";
import { logAccess } from "@/features/audit/log";
import { getClinicalAccess } from "@/features/clinical/queries";
import { SpecialtyTabs } from "@/features/specialty/components/specialty-tabs";
import { getPatientSpecialty } from "@/features/specialty/queries";

export const metadata: Metadata = { title: "Fichas clínicas" };

export default async function Page({ params, searchParams }: PageProps<"/pacientes/[id]/fichas">) {
  const { id } = await params;
  const query = await searchParams;
  const access = await getClinicalAccess();
  if (!access.canRead) {
    return <EmptyState icon={ShieldCheck} title="Acesso restrito" description="As fichas clínicas são vistas só pelos dentistas e pela gestão." />;
  }
  await logAccess("view", "specialty_records", id);
  const { templates, records } = await getPatientSpecialty(id);
  return (
    <SpecialtyTabs
      key={`${query.ficha ?? ""}-${query.versao ?? ""}`}
      patientId={id}
      templates={templates}
      records={records}
      canWrite={access.canWrite}
      selectedId={z.uuid().nullable().catch(null).parse(query.ficha ?? null)}
      versionId={z.uuid().nullable().catch(null).parse(query.versao ?? null)}
    />
  );
}
