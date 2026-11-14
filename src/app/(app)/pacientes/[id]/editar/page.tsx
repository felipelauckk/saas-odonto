import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PatientForm } from "@/features/patients/components/patient-form";
import { getPatient } from "@/features/patients/queries";

export const metadata: Metadata = { title: "Editar paciente" };

export default async function Page({ params }: PageProps<"/pacientes/[id]/editar">) {
  const { id } = await params;
  const patient = await getPatient(id);
  if (!patient) notFound();
  return (
    <div className="max-w-3xl">
      <PatientForm patient={patient} />
    </div>
  );
}
