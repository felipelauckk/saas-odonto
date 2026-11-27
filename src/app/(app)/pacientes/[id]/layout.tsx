import { notFound } from "next/navigation";
import { z } from "zod";

import { getClinicalAccess, getPatientAlerts } from "@/features/clinical/queries";
import { patientPhotoUrl } from "@/features/patients/actions";
import { PatientHeader } from "@/features/patients/components/patient-header";
import { PatientSummary } from "@/features/patients/components/patient-summary";
import { PatientTabs } from "@/features/patients/components/patient-tabs";
import { getPatient, getPatientSummary } from "@/features/patients/queries";
import { requireClinic } from "@/features/tenancy/guards";
import { optional } from "@/lib/optional";
import { getSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

/** Links públicos da clínica (agendamento online ativo e formulário de captação). */
async function publicLinks(clinicId: string, patientId: string) {
  const supabase = await createClient();
  const [site, { data: booking }, { data: clinic }] = await Promise.all([
    getSiteUrl(),
    supabase.from("online_booking_settings").select("slug, enabled").eq("clinic_id", clinicId).maybeSingle(),
    supabase.from("clinics").select("lead_form_token").eq("id", clinicId).maybeSingle(),
  ]);
  return {
    bookingUrl: booking?.enabled && booking.slug ? `${site}/agendar/${booking.slug}` : null,
    referralUrl: clinic?.lead_form_token ? `${site}/captacao/${clinic.lead_form_token}?origem=indicacao&indicado_por=${patientId}` : null,
  };
}

export default async function PatientLayout({ children, params }: LayoutProps<"/pacientes/[id]">) {
  const session = await requireClinic();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  // Saldo e situação financeira só para quem opera o financeiro (o dentista vê só parte das cobranças).
  const operatesFinance = session.clinic.role !== "dentist";
  const [patient, alerts, access, summary, links] = await Promise.all([
    getPatient(id),
    getPatientAlerts(id),
    getClinicalAccess(),
    optional("ficha", getPatientSummary(id, operatesFinance)),
    publicLinks(session.clinic.id, id),
  ]);
  if (!patient) notFound();
  const photoUrl = await patientPhotoUrl(patient.photo_path);
  const balance = summary.ok ? summary.value.balance : null;

  return (
    <div className="space-y-6">
      <PatientHeader
        patient={patient}
        canExport={access.canRead}
        canPortal={operatesFinance}
        photoUrl={photoUrl}
        finance={balance ? { overdueCents: balance.overdueCents } : null}
        bookingUrl={links.bookingUrl}
        referralUrl={operatesFinance ? links.referralUrl : null}
      />
      <PatientSummary alerts={alerts} summary={summary} />
      <PatientTabs patientId={patient.id} />
      {children}
    </div>
  );
}
