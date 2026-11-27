import type { Metadata } from "next";

import { logAccess } from "@/features/audit/log";
import { PatientFiles } from "@/features/clinical/components/patient-files";
import { ClinicalRestricted } from "@/features/clinical/components/restricted";
import { getClinicalAccess, listFileFolders, listPatientFiles } from "@/features/clinical/queries";

export const metadata: Metadata = { title: "Arquivos" };

export default async function Page({ params }: PageProps<"/pacientes/[id]/arquivos">) {
  const { id } = await params;
  const access = await getClinicalAccess();
  if (!access.canRead) return <ClinicalRestricted />;
  await logAccess("view", "patient_files", id);
  const [files, folders] = await Promise.all([listPatientFiles(id), listFileFolders(id)]);
  return <PatientFiles patientId={id} files={files} folders={folders} canWrite={access.canWrite} />;
}
