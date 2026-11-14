import type { Metadata } from "next";

import { logAccess } from "@/features/audit/log";
import { ShieldCheck } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { AlertsBanner } from "@/features/clinical/components/alerts-banner";
import { AnamnesisView } from "@/features/clinical/components/anamnesis-view";
import { getAnamnesis, getClinicalAccess, getPatientAlerts } from "@/features/clinical/queries";

export const metadata: Metadata = { title: "Anamnese" };

export default async function Page({ params }: PageProps<"/pacientes/[id]/anamnese">) {
  const { id } = await params;
  const access = await getClinicalAccess();

  // Recepção: só os alertas.
  if (!access.canRead) {
    const alerts = await getPatientAlerts(id);
    return alerts.length ? (
      <AlertsBanner alerts={alerts} />
    ) : (
      <EmptyState
        icon={ShieldCheck}
        title="Nenhum alerta na anamnese"
        description="Os detalhes da anamnese são vistos só pelos dentistas e pela gestão."
      />
    );
  }

  await logAccess("view", "anamneses", id);
  const { versions, template } = await getAnamnesis(id);
  return <AnamnesisView patientId={id} versions={versions} template={template} canWrite={access.canWrite} />;
}
