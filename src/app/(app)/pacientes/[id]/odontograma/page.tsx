import type { Metadata } from "next";

import { logAccess } from "@/features/audit/log";
import { ClinicalRestricted } from "@/features/clinical/components/restricted";
import { Odontogram } from "@/features/clinical/components/odontogram";
import { getClinicalAccess, getToothRecords } from "@/features/clinical/queries";
import { getPatient } from "@/features/patients/queries";
import { getActivePatientPlan } from "@/features/plans/queries";
import { requireClinic } from "@/features/tenancy/guards";
import { ageFromBirthDate } from "@/lib/dates";
import { optional } from "@/lib/optional";

export const metadata: Metadata = { title: "Odontograma" };

export default async function Page({ params }: PageProps<"/pacientes/[id]/odontograma">) {
  const { id } = await params;
  const [session, access] = await Promise.all([requireClinic(), getClinicalAccess()]);
  if (!access.canRead) return <ClinicalRestricted />;
  await logAccess("view", "tooth_records", id);

  const [records, patient, plan] = await Promise.all([getToothRecords(id), getPatient(id), optional("odontograma", getActivePatientPlan(id))]);
  // Criança até 12 anos abre nos decíduos.
  const startWithDeciduous = patient?.birth_date ? ageFromBirthDate(patient.birth_date) <= 12 : false;

  return (
    <Odontogram
      patientId={id}
      records={records}
      canWrite={access.canWrite}
      // Mesma regra da tela do orçamento: dentistas e a gestão marcam realizado.
      canMarkDone={["owner", "manager", "dentist"].includes(session.clinic.role)}
      startWithDeciduous={startWithDeciduous}
      plan={plan.ok ? plan.value : null}
      planFailed={!plan.ok}
    />
  );
}
