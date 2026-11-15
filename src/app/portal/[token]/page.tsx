import type { Metadata } from "next";
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
      <div className="min-h-full bg-background px-4 py-8">
        <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3 rounded-xl border p-8 text-center">
          <Link2Off className="size-8 text-muted-foreground" aria-hidden />
          <h1 className="text-lg font-medium">Link expirado ou inválido</h1>
          <p className="text-sm text-muted-foreground">Peça um novo link à clínica pelo WhatsApp.</p>
        </div>
      </div>
    );
  }
  const data = await loadPortal(session);
  return (
    <div className="min-h-full bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{session.clinicName}</p>
          <h1 className="text-xl font-semibold tracking-tight">Olá, {firstName(session.patientName)}!</h1>
        </div>
        <PortalView
          token={token}
          data={data}
          actions={{ confirm: confirmAppointmentAction, reschedule: rescheduleAction, approve: approvePlanAction, pay: payAction, sign: signAction }}
        />
      </div>
    </div>
  );
}
