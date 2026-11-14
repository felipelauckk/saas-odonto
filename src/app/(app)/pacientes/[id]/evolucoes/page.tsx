import type { Metadata } from "next";

import { logAccess } from "@/features/audit/log";

import { ClinicalNotes } from "@/features/clinical/components/clinical-notes";
import { ClinicalRestricted } from "@/features/clinical/components/restricted";
import { getClinicalAccess, listClinicalNotes } from "@/features/clinical/queries";

export const metadata: Metadata = { title: "Evoluções" };

export default async function Page({ params }: PageProps<"/pacientes/[id]/evolucoes">) {
  const { id } = await params;
  const access = await getClinicalAccess();
  if (!access.canRead) return <ClinicalRestricted />;
  await logAccess("view", "clinical_notes", id);
  const notes = await listClinicalNotes(id);
  return <ClinicalNotes patientId={id} notes={notes} canWrite={access.canWrite} professionals={access.professionals} />;
}
