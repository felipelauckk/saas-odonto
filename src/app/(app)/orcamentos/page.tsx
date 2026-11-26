import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { cn } from "cn";

import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { PlansList } from "@/features/plans/components/plans-list";
import { planStatusLabels, planStatuses, type PlanStatus } from "@/features/plans/labels";
import { listPlans } from "@/features/plans/queries";
import { requireClinic } from "@/features/tenancy/guards";

export const metadata: Metadata = { title: "Orçamentos" };

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Em aberto" },
  ...planStatuses.filter((s) => !["draft", "presented"].includes(s)).map((s) => ({ value: s, label: planStatusLabels[s] })),
  { value: "todos", label: "Todos" },
];

export default async function Page({ searchParams }: PageProps<"/orcamentos">) {
  await requireClinic();
  const { status } = await searchParams;
  const current = typeof status === "string" ? status : "";
  const filter: PlanStatus | "open" | null =
    current === "todos" ? null : planStatuses.includes(current as PlanStatus) ? (current as PlanStatus) : "open";
  const plans = await listPlans({ status: filter });

  const newButton = (
    <Link href="/orcamentos/novo" className={buttonVariants()}>
      <Plus aria-hidden />
      Novo orçamento
    </Link>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Orçamentos" description="Planos de tratamento apresentados aos pacientes." actions={newButton} />
      <nav className="flex flex-wrap gap-2" aria-label="Filtrar orçamentos">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value ? `/orcamentos?status=${f.value}` : "/orcamentos"}
            aria-current={current === f.value ? "page" : undefined}
            className={cn(
              "inline-flex h-8 items-center rounded-full border px-3 text-sm transition-colors pointer-coarse:h-11",
              current === f.value ? "border-foreground bg-foreground font-semibold text-background" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      {plans.length ? (
        <PlansList plans={plans} />
      ) : (
        <EmptyState icon={FileText} title="Nenhum orçamento aqui" description="Crie um orçamento a partir da ficha do paciente ou pelo botão acima." />
      )}
    </div>
  );
}
