import type { Metadata } from "next";

import { SubpageHeader } from "@/components/layout/subpage-header";
import { PatientForm } from "@/features/patients/components/patient-form";
import { requireClinic } from "@/features/tenancy/guards";

export const metadata: Metadata = { title: "Novo paciente" };

export default async function Page() {
  await requireClinic();
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <SubpageHeader title="Novo paciente" backHref="/pacientes" backLabel="Pacientes" />
      <PatientForm />
    </div>
  );
}
