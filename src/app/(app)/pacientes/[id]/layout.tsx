import { notFound } from "next/navigation";
import { z } from "zod";

import { AlertsBanner } from "@/features/clinical/components/alerts-banner";
import { getClinicalAccess, getPatientAlerts } from "@/features/clinical/queries";
import { PortalLinkButton } from "@/features/booking/components/portal-link-button";
import { PatientHeader } from "@/features/patients/components/patient-header";
import { PatientTabs } from "@/features/patients/components/patient-tabs";
import { getPatient } from "@/features/patients/queries";
import { requireClinic } from "@/features/tenancy/guards";

export default async function PatientLayout({ children, params }: LayoutProps<"/pacientes/[id]">) {
  const session = await requireClinic();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [patient, alerts, access] = await Promise.all([getPatient(id), getPatientAlerts(id), getClinicalAccess()]);
  if (!patient) notFound();

  return (
    <div className="space-y-6">
      <PatientHeader patient={patient} canExport={access.canRead} portal={session.clinic.role !== "dentist" && !patient.archived_at ? <PortalLinkButton patientId={patient.id} /> : null} />
      <AlertsBanner alerts={alerts} />
      <PatientTabs patientId={patient.id} />
      {children}
    </div>
  );
}
