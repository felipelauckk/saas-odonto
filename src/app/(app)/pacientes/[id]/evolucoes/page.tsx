import type { Metadata } from "next";

import { ClinicalNotes } from "@/features/clinical/components/clinical-notes";
import { ClinicalRestricted } from "@/features/clinical/components/restricted";
import { getClinicalAccess, listClinicalNotes } from "@/features/clinical/queries";

export const metadata: Metadata = { title: "Evoluções" };

export default async function Page({ params }: PageProps<"/pacientes/[id]/evolucoes">) {
  const { id } = await params;
  const access = await getClinicalAccess();
  if (!access.canRead) return <ClinicalRestricted />;
  const notes = await listClinicalNotes(id);
  return <ClinicalNotes patientId={id} notes={notes} canWrite={access.canWrite} professionals={access.professionals} />;
}
