import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PatientDetails } from "@/features/patients/components/patient-details";
import { PatientPhotoField } from "@/features/patients/components/patient-photo-field";
import { getPatient } from "@/features/patients/queries";
import { requireClinic } from "@/features/tenancy/guards";

export const metadata: Metadata = { title: "Dados do paciente" };

export default async function Page({ params }: PageProps<"/pacientes/[id]/dados">) {
  const session = await requireClinic();
  const { id } = await params;
  const patient = await getPatient(id);
  if (!patient) notFound();
  return (
    <PatientDetails
      patient={patient}
      photo={<PatientPhotoField patientId={patient.id} clinicId={session.clinic.id} initialPath={patient.photo_path} name={patient.full_name} />}
    />
  );
}
