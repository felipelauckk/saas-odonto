import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { loadPatientFormOptions } from "@/features/patients/actions";
import { PatientForm } from "@/features/patients/components/patient-form";
import { getPatient } from "@/features/patients/queries";

export const metadata: Metadata = { title: "Editar paciente" };

export default async function Page({ params }: PageProps<"/pacientes/[id]/editar">) {
  const { id } = await params;
  const [patient, options] = await Promise.all([getPatient(id), loadPatientFormOptions()]);
  if (!patient) notFound();
  return (
    <div className="max-w-4xl">
      <PatientForm patient={patient} options={options} mode="full" />
    </div>
  );
}
