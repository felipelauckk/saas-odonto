import type { Metadata } from "next";

import { logAccess } from "@/features/audit/log";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { z } from "zod";

import { PlanDetailView } from "@/features/plans/components/plan-detail";
import { PlanStatusBadge } from "@/features/plans/components/plan-status-badge";
import { getPlan } from "@/features/plans/queries";
import { requireClinic } from "@/features/tenancy/guards";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Orçamento" };

export default async function Page({ params }: PageProps<"/orcamentos/[id]">) {
  const session = await requireClinic();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const detail = await getPlan(id);
  if (!detail) notFound();
  const { plan, items, receivables } = detail;
  await logAccess("view", "treatment_plans", plan.patient_id, plan.id);

  const supabase = await createClient();
  const { data: paymentMethods } = await supabase.from("payment_methods").select("id, name").eq("active", true).order("created_at");

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link href={`/pacientes/${plan.patient_id}/orcamentos`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground pointer-coarse:min-h-11">
          <ChevronLeft className="size-4" aria-hidden />
          {plan.patients?.full_name}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Orçamento</h1>
          <PlanStatusBadge status={plan.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {plan.patients?.full_name} · {plan.professionals?.name} · criado em {formatDate(plan.created_at)}
          {plan.approved_at ? ` · aprovado em ${formatDate(plan.approved_at)}` : ""}
        </p>
      </div>
      <PlanDetailView
        plan={{
          id: plan.id,
          status: plan.status,
          total_cents: plan.total_cents,
          discount_cents: plan.discount_cents,
          installments: plan.installments,
          notes: plan.notes,
          valid_until: plan.valid_until,
          created_at: plan.created_at,
          approved_at: plan.approved_at,
          patientName: plan.patients?.full_name ?? "",
          professionalName: plan.professionals?.name ?? "",
          paymentMethodName: plan.payment_methods?.name ?? null,
        }}
        items={items}
        receivables={receivables}
        paymentMethods={paymentMethods ?? []}
        canMarkDone={["owner", "manager", "dentist"].includes(session.clinic.role)}
      />
    </div>
  );
}
