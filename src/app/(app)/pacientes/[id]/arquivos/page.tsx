import type { Metadata } from "next";

import { PatientFiles } from "@/features/clinical/components/patient-files";
import { ClinicalRestricted } from "@/features/clinical/components/restricted";
import { getClinicalAccess, listPatientFiles } from "@/features/clinical/queries";

export const metadata: Metadata = { title: "Arquivos" };

export default async function Page({ params }: PageProps<"/pacientes/[id]/arquivos">) {
  const { id } = await params;
  const access = await getClinicalAccess();
  if (!access.canRead) return <ClinicalRestricted />;
  const files = await listPatientFiles(id);
  return <PatientFiles patientId={id} files={files} canWrite={access.canWrite} />;
}
