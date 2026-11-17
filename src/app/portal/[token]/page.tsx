import type { Metadata } from "next";
import { PublicNotice, PublicShell } from "@/components/app/public-shell";
import { Link2Off } from "lucide-react";

import { PortalView } from "@/features/booking/components/portal-view";
import { loadPortal, openPortal } from "@/features/booking/portal";
import { firstName } from "@/lib/messaging/render";

import { approvePlanAction, confirmAppointmentAction, payAction, rescheduleAction, signAction } from "./actions";

export const metadata: Metadata = { title: "Portal do paciente", robots: { index: false, follow: false } };

export default async function Page({ params }: PageProps<"/portal/[token]">) {
  const { token } = await params;
  const session = await openPortal(token);
  if (!session) {
    return (
      <PublicShell clinicName={null}>
        <PublicNotice icon={<Link2Off aria-hidden />} title="Link expirado ou inválido">
          Peça um novo link à clínica pelo WhatsApp.
        </PublicNotice>
      </PublicShell>
    );
  }
  const data = await loadPortal(session);
  return (
    <PublicShell clinicName={session.clinicName} detail="Portal do paciente" width="lg">
      <h1 className="type-title">Olá, {firstName(session.patientName)}!</h1>
      <PortalView
        token={token}
        data={data}
        actions={{ confirm: confirmAppointmentAction, reschedule: rescheduleAction, approve: approvePlanAction, pay: payAction, sign: signAction }}
      />
    </PublicShell>
  );
}
