import type { Metadata } from "next";

import { SubpageHeader } from "@/components/layout/subpage-header";
import { loadPatientFormOptions } from "@/features/patients/actions";
import { PatientForm } from "@/features/patients/components/patient-form";
import { requireClinic } from "@/features/tenancy/guards";

export const metadata: Metadata = { title: "Novo paciente" };

export default async function Page() {
  await requireClinic();
  const options = await loadPatientFormOptions();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <SubpageHeader title="Novo paciente" backHref="/pacientes" backLabel="Pacientes" />
      <PatientForm options={options} mode="full" />
    </div>
  );
}
