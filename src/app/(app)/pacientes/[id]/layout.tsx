import { notFound } from "next/navigation";
import { z } from "zod";

import { getClinicalAccess, getPatientAlerts } from "@/features/clinical/queries";
import { PortalLinkButton } from "@/features/booking/components/portal-link-button";
import { PatientHeader } from "@/features/patients/components/patient-header";
import { PatientSummary } from "@/features/patients/components/patient-summary";
import { PatientTabs } from "@/features/patients/components/patient-tabs";
import { getPatient, getPatientSummary } from "@/features/patients/queries";
import { requireClinic } from "@/features/tenancy/guards";
import { optional } from "@/lib/optional";

export default async function PatientLayout({ children, params }: LayoutProps<"/pacientes/[id]">) {
  const session = await requireClinic();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  // Saldo em aberto só para quem opera o financeiro (o dentista vê só parte das cobranças).
  const operatesFinance = session.clinic.role !== "dentist";
  const [patient, alerts, access, summary] = await Promise.all([
    getPatient(id),
    getPatientAlerts(id),
    getClinicalAccess(),
    optional("ficha", getPatientSummary(id, operatesFinance)),
  ]);
  if (!patient) notFound();

  return (
    <div className="space-y-6">
      <PatientHeader patient={patient} canExport={access.canRead} portal={operatesFinance && !patient.archived_at ? <PortalLinkButton patientId={patient.id} /> : null} />
      <PatientSummary alerts={alerts} summary={summary} />
      <PatientTabs patientId={patient.id} />
      {children}
    </div>
  );
}
