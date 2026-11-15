import type { Metadata } from "next";
import { MapPin } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { AgendaView } from "@/features/agenda/components/agenda-view";
import { getAgendaData } from "@/features/agenda/queries";
import { agendaParamsSchema } from "@/features/agenda/schemas";
import { requireClinic } from "@/features/tenancy/guards";
import { formatPhone } from "@/lib/documents";
import { createClient } from "@/lib/supabase/server";
import { todayIso } from "@/lib/dates";
import { startOfWeek } from "@/lib/timezone";

export const metadata: Metadata = { title: "Agenda" };

export default async function Page({ searchParams }: PageProps<"/agenda">) {
  const session = await requireClinic();
  const params = agendaParamsSchema.parse(await searchParams);
  const today = todayIso();
  const date = params.data ?? today;
  const unit = session.activeUnit;

  if (!unit) {
    return (
      <div className="space-y-8">
        <PageHeader title="Agenda" />
        <EmptyState icon={MapPin} title="Nenhuma unidade disponível" description="Você não tem acesso a nenhuma unidade ativa desta clínica." />
      </div>
    );
  }

  const isDentist = session.clinic.role === "dentist";
  const view = params.visao;
  const data = await getAgendaData({
    unitId: unit.id,
    from: view === "semana" ? startOfWeek(date) : date,
    days: view === "semana" ? 7 : 1,
    isDentist,
  });

  let presetPatient = null;
  if (params.paciente) {
    const supabase = await createClient();
    const { data: p } = await supabase.from("patients").select("id, full_name, phone, whatsapp").eq("id", params.paciente).is("archived_at", null).maybeSingle();
    const phone = p?.whatsapp ?? p?.phone;
    if (p) presetPatient = { id: p.id, name: p.full_name, detail: phone ? formatPhone(phone) : null };
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agenda"
        description={session.units.length > 1 ? unit.name : isDentist ? "Sua agenda" : undefined}
      />
      <AgendaView
        data={data}
        unitId={unit.id}
        date={date}
        today={today}
        view={view}
        by={params.por}
        selectedId={params.id ?? null}
        isDentist={isDentist}
        presetPatient={presetPatient}
      />
    </div>
  );
}
