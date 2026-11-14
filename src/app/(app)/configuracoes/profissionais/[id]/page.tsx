import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { SettingsHeader } from "@/components/layout/settings-header";
import { EditProfessionalButton } from "@/features/settings/components/professionals-manager";
import { ScheduleEditor } from "@/features/settings/components/schedule-editor";
import { StatusBadge } from "@/features/settings/components/status-badge";
import { getProfessional, listLinkableMembers, listUnits } from "@/features/settings/queries";
import { requireManager } from "@/features/tenancy/guards";

export const metadata: Metadata = { title: "Profissional" };

export default async function Page({ params }: PageProps<"/configuracoes/profissionais/[id]">) {
  await requireManager();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [data, members, units] = await Promise.all([getProfessional(id), listLinkableMembers(), listUnits()]);
  if (!data) notFound();
  const { professional, schedules } = data;
  const activeUnits = units.filter((u) => u.active);

  return (
    <div className="space-y-8">
      <SettingsHeader
        title={professional.name}
        backHref="/configuracoes/profissionais"
        backLabel="Profissionais"
        description={
          [professional.specialty, professional.cro ? `CRO ${professional.cro}` : null].filter(Boolean).join(" · ") ||
          undefined
        }
        actions={<EditProfessionalButton professional={professional} members={members} />}
      />
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="size-3 rounded-full" style={{ backgroundColor: professional.color }} aria-hidden />
        Cor na agenda
        {!professional.active ? <StatusBadge active={false} /> : null}
      </div>
      <section className="space-y-4" aria-labelledby="horarios">
        <div className="space-y-1">
          <h2 id="horarios" className="text-base font-medium">
            Horários de atendimento
          </h2>
          <p className="text-sm text-muted-foreground">
            A agenda usa estes horários para mostrar quando o profissional está disponível.
          </p>
        </div>
        <ScheduleEditor professionalId={professional.id} units={activeUnits} initial={schedules} />
      </section>
    </div>
  );
}
