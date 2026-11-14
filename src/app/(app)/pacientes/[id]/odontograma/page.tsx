import type { Metadata } from "next";

import { ClinicalRestricted } from "@/features/clinical/components/restricted";
import { Odontogram } from "@/features/clinical/components/odontogram";
import { getClinicalAccess, getToothRecords } from "@/features/clinical/queries";
import { getPatient } from "@/features/patients/queries";
import { ageFromBirthDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Odontograma" };

export default async function Page({ params }: PageProps<"/pacientes/[id]/odontograma">) {
  const { id } = await params;
  const access = await getClinicalAccess();
  if (!access.canRead) return <ClinicalRestricted />;

  const [records, patient] = await Promise.all([getToothRecords(id), getPatient(id)]);
  // Criança até 12 anos abre nos decíduos.
  const startWithDeciduous = patient?.birth_date ? ageFromBirthDate(patient.birth_date) <= 12 : false;

  return <Odontogram patientId={id} records={records} canWrite={access.canWrite} startWithDeciduous={startWithDeciduous} />;
}
