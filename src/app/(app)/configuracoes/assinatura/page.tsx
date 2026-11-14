import type { Metadata } from "next";
import { CreditCard } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { SubpageHeader } from "@/components/layout/subpage-header";
import { Badge } from "@/components/ui/badge";
import { PlanPicker } from "@/features/billing/components/plan-picker";
import { subscriptionStatusLabels } from "@/features/billing/labels";
import { getBillingOverview } from "@/features/billing/queries";
import { requireManager } from "@/features/tenancy/guards";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Assinatura" };

export default async function Page() {
  const session = await requireManager();
  const overview = await getBillingOverview();
  if (!overview) return null;
  const { clinic, plans, accessState, usage } = overview;
  const trialEnd = clinic.trial_ends_at ? formatDate(clinic.trial_ends_at) : null;

  return (
    <div className="space-y-8">
      <SubpageHeader title="Assinatura" description="Plano do sistema, cobrança e situação da conta." />

      <section className="space-y-2 rounded-xl border p-5 sm:p-6" aria-label="Situação">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-medium">{clinic.plans?.name ?? "Sem plano"}</span>
          <Badge variant={accessState === "read_only" ? "destructive" : clinic.subscription_status === "active" ? "default" : "secondary"}>
            {accessState === "read_only" ? "Somente leitura" : subscriptionStatusLabels[clinic.subscription_status]}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {clinic.subscription_status === "trialing" && trialEnd ? `Teste grátis até ${trialEnd}. ` : ""}
          {clinic.subscription_status === "past_due" && clinic.past_due_since ? `Pagamento em atraso desde ${formatDate(clinic.past_due_since)}. ` : ""}
          Em uso: {usage.units} {usage.units === 1 ? "unidade" : "unidades"} e {usage.professionals}{" "}
          {usage.professionals === 1 ? "profissional" : "profissionais"}.
        </p>
        <p className="text-sm text-muted-foreground">Pagamento por Pix, boleto ou cartão, direto na fatura do Asaas.</p>
      </section>

      {plans.length ? (
        <PlanPicker
          plans={plans}
          currentPlanId={clinic.plan_id}
          status={clinic.subscription_status}
          hasSubscription={Boolean(clinic.asaas_subscription_id)}
          isOwner={session.clinic.role === "owner"}
        />
      ) : (
        <EmptyState icon={CreditCard} title="Nenhum plano disponível ainda" description="Os planos são cadastrados pelo administrador do sistema." />
      )}
    </div>
  );
}
