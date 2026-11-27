import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { SubpageHeader } from "@/components/layout/subpage-header";
import { type Face } from "@/features/clinical/odontogram";
import { PlanBuilder } from "@/features/plans/components/plan-builder";
import { loadBuilderData } from "@/features/plans/builder-data";
import { OPEN_STATUSES } from "@/features/plans/labels";
import { getPlan } from "@/features/plans/queries";
import { requireClinic } from "@/features/tenancy/guards";

export const metadata: Metadata = { title: "Editar orçamento" };

export default async function Page({ params }: PageProps<"/orcamentos/[id]/editar">) {
  await requireClinic();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const detail = await getPlan(id);
  if (!detail) notFound();
  const { plan, items } = detail;
  if (!OPEN_STATUSES.includes(plan.status)) redirect(`/orcamentos/${id}`);
  const data = await loadBuilderData(plan.patient_id);

  return (
    <div className="space-y-6">
      <SubpageHeader title="Editar orçamento" backHref={`/orcamentos/${id}`} backLabel="Orçamento" />
      <PlanBuilder
        planId={plan.id}
        patient={{ id: plan.patient_id, name: plan.patients?.full_name ?? "Paciente", detail: null }}
        professionalId={plan.professional_id}
        professionals={data.professionals}
        procedures={data.procedures}
        suggestions={data.suggestions}
        initialItems={items.map((i) => ({
          procedureId: i.procedure_id,
          description: i.description,
          tooth: i.tooth,
          faces: i.faces as Face[],
          sessions: i.sessions_planned,
          priceCents: i.price_cents,
        }))}
        initialNotes={plan.notes ?? ""}
        initialValidUntil={plan.valid_until}
      />
    </div>
  );
}
