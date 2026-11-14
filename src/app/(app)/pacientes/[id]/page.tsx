import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PatientDetails } from "@/features/patients/components/patient-details";
import { getPatient } from "@/features/patients/queries";

export const metadata: Metadata = { title: "Paciente" };

export default async function Page({ params }: PageProps<"/pacientes/[id]">) {
  const { id } = await params;
  const patient = await getPatient(id);
  if (!patient) notFound();
  return <PatientDetails patient={patient} />;
}
