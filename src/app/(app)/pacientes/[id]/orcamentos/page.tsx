import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { PlansList } from "@/features/plans/components/plans-list";
import { listPatientPlans } from "@/features/plans/queries";

export const metadata: Metadata = { title: "Orçamentos" };

export default async function Page({ params }: PageProps<"/pacientes/[id]/orcamentos">) {
  const { id } = await params;
  const plans = await listPatientPlans(id);
  const newButton = (
    <Link href={`/orcamentos/novo?paciente=${id}`} className={buttonVariants()}>
      <Plus aria-hidden />
      Novo orçamento
    </Link>
  );
  if (!plans.length) return <EmptyState icon={FileText} title="Nenhum orçamento" description="Monte o primeiro orçamento deste paciente." action={newButton} />;
  return (
    <div className="space-y-4">
      <div className="flex justify-end">{newButton}</div>
      <PlansList plans={plans} showPatient={false} />
    </div>
  );
}
