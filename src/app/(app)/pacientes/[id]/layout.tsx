import { notFound } from "next/navigation";
import { z } from "zod";

import { PatientHeader } from "@/features/patients/components/patient-header";
import { PatientTabs } from "@/features/patients/components/patient-tabs";
import { getPatient } from "@/features/patients/queries";
import { requireClinic } from "@/features/tenancy/guards";

export default async function PatientLayout({ children, params }: LayoutProps<"/pacientes/[id]">) {
  await requireClinic();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const patient = await getPatient(id);
  if (!patient) notFound();

  return (
    <div className="space-y-6">
      <PatientHeader patient={patient} />
      <PatientTabs patientId={patient.id} />
      {children}
    </div>
  );
}
