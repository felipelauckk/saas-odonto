import type { Metadata } from "next";

import { logAccess } from "@/features/audit/log";
import { PatientExams } from "@/features/clinical/components/patient-exams";
import { ClinicalRestricted } from "@/features/clinical/components/restricted";
import { getClinicalAccess, listPatientFiles } from "@/features/clinical/queries";

export const metadata: Metadata = { title: "Exames" };

export default async function Page({ params }: PageProps<"/pacientes/[id]/exames">) {
  const { id } = await params;
  const access = await getClinicalAccess();
  if (!access.canRead) return <ClinicalRestricted />;
  await logAccess("view", "patient_files", id);
  const exams = await listPatientFiles(id, { exams: true });
  return <PatientExams patientId={id} exams={exams} canWrite={access.canWrite} />;
}
