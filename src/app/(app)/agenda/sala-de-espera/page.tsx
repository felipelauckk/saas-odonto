import type { Metadata } from "next";

import { SubpageHeader } from "@/components/layout/subpage-header";
import { WaitingRoom } from "@/features/agenda/components/waiting-room";
import { requireClinic } from "@/features/tenancy/guards";
import { todayIso } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { addDays, utcToZoned, zonedToUtc } from "@/lib/timezone";

export const metadata: Metadata = { title: "Sala de espera" };

export default async function Page() {
  const session = await requireClinic();
  const unit = session.activeUnit;
  if (!unit) return null;
  const today = todayIso();
  const supabase = await createClient();
  const { data } = await supabase
    .from("appointments")
    .select("id, starts_at, arrived_at, patients(full_name), professionals(name)")
    .eq("unit_id", unit.id)
    .eq("status", "arrived")
    .gte("starts_at", zonedToUtc(today, "00:00").toISOString())
    .lt("starts_at", zonedToUtc(addDays(today, 1), "00:00").toISOString())
    .order("arrived_at");
  const rows = (data ?? []).map((a) => ({
    id: a.id,
    patientName: a.patients?.full_name ?? "",
    professionalName: a.professionals?.name ?? "",
    scheduledTime: utcToZoned(a.starts_at).time,
    arrivedAt: a.arrived_at ?? a.starts_at,
  }));
  return (
    <div className="space-y-6">
      <SubpageHeader title="Sala de espera" description={`Quem chegou e aguarda atendimento · ${unit.name}. Atualiza sozinha.`} backHref="/agenda" backLabel="Agenda" />
      <WaitingRoom rows={rows} unitId={unit.id} />
    </div>
  );
}
