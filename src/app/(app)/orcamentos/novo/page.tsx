import type { Metadata } from "next";
import { z } from "zod";

import { SubpageHeader } from "@/components/layout/subpage-header";
import { PlanBuilder } from "@/features/plans/components/plan-builder";
import { loadBuilderData } from "@/features/plans/builder-data";
import { getPatient } from "@/features/patients/queries";
import { requireClinic } from "@/features/tenancy/guards";

export const metadata: Metadata = { title: "Novo orçamento" };

export default async function Page({ searchParams }: PageProps<"/orcamentos/novo">) {
  await requireClinic();
  const { paciente } = await searchParams;
  const patientId = z.uuid().safeParse(paciente).success ? (paciente as string) : null;
  const [patient, data] = await Promise.all([patientId ? getPatient(patientId) : null, loadBuilderData(patientId)]);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <SubpageHeader
        title="Novo orçamento"
        backHref={patient ? `/pacientes/${patient.id}/orcamentos` : "/orcamentos"}
        backLabel={patient ? patient.full_name : "Orçamentos"}
      />
      <PlanBuilder
        patient={patient ? { id: patient.id, name: patient.full_name, detail: patient.whatsapp ?? patient.phone } : null}
        professionalId={data.ownProfessionalId ?? data.professionals[0]?.id ?? ""}
        professionals={data.professionals}
        procedures={data.procedures}
        suggestions={data.suggestions}
        initialItems={[]}
        initialNotes=""
        initialValidUntil={null}
      />
    </div>
  );
}
