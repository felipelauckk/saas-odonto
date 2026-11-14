import Link from "next/link";
import { Building2 } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { listClinicsForAdmin } from "@/features/admin/queries";
import { subscriptionStatusLabels } from "@/features/billing/labels";
import { formatCurrency, formatDate } from "@/lib/format";

export const metadata = { title: "Clínicas" };

export default async function Page() {
  const clinics = await listClinicsForAdmin();
  const active = clinics.filter((c) => c.subscription_status === "active");
  const mrr = active.reduce((s, c) => s + (c.plans?.price_cents ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Clínicas" description="Assinaturas do SaaS. Dados de pacientes não aparecem aqui." />
      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border p-4"><dt className="text-sm text-muted-foreground">Clínicas</dt><dd className="text-2xl font-semibold">{clinics.length}</dd></div>
        <div className="rounded-xl border p-4"><dt className="text-sm text-muted-foreground">Assinaturas ativas</dt><dd className="text-2xl font-semibold">{active.length}</dd></div>
        <div className="rounded-xl border p-4"><dt className="text-sm text-muted-foreground">Receita mensal (ativas)</dt><dd className="text-2xl font-semibold tabular-nums">{formatCurrency(mrr)}</dd></div>
      </dl>
      {clinics.length ? (
        <ul className="divide-y rounded-xl border">
          {clinics.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/clinicas/${c.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-muted/50 sm:px-5">
                <span className="min-w-0 flex-1 font-medium">{c.name}</span>
                <Badge variant={c.subscription_status === "active" ? "default" : c.subscription_status === "trialing" ? "secondary" : "destructive"}>
                  {subscriptionStatusLabels[c.subscription_status]}
                </Badge>
                <span className="text-sm text-muted-foreground">{c.plans?.name ?? "Sem plano"}</span>
                <span className="text-sm text-muted-foreground">{c.members} {c.members === 1 ? "usuário" : "usuários"}</span>
                <span className="text-sm text-muted-foreground">
                  {c.subscription_status === "trialing" && c.trial_ends_at ? `teste até ${formatDate(c.trial_ends_at)}` : `desde ${formatDate(c.created_at)}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={Building2} title="Nenhuma clínica cadastrada" />
      )}
    </div>
  );
}
