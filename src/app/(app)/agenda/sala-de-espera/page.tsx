import type { Metadata } from "next";

import { SubpageHeader } from "@/components/layout/subpage-header";
import { WaitingRoom } from "@/features/agenda/components/waiting-room";
import { getWaitingRoom } from "@/features/agenda/queries";
import { requireClinic } from "@/features/tenancy/guards";
import { todayIso } from "@/lib/dates";

export const metadata: Metadata = { title: "Sala de espera" };

export default async function Page() {
  const session = await requireClinic();
  const unit = session.activeUnit;
  if (!unit) return null;
  const today = todayIso();
  const rows = await getWaitingRoom(unit.id, today);
  return (
    <div className="space-y-6">
      <SubpageHeader title="Sala de espera" description={`Quem chegou e aguarda atendimento · ${unit.name}. Atualiza sozinha.`} backHref="/agenda" backLabel="Agenda" />
      <WaitingRoom rows={rows} unitId={unit.id} />
    </div>
  );
}
