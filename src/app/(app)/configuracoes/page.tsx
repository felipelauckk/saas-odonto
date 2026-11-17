import type { Metadata } from "next";
import Link from "next/link";

import { KpiStrip } from "@/components/app/kpi-strip";
import { StatusBadge } from "@/components/app/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { getBillingOverview } from "@/features/billing/queries";
import { subscriptionStatusLabels } from "@/features/billing/labels";
import { SettingsMenu } from "@/features/settings/components/settings-menu";
import { getIntegrations, getSettingsSummary } from "@/features/settings/queries";
import { requireManager } from "@/features/tenancy/guards";
import { formatDate } from "@/lib/format";
import { optional } from "@/lib/optional";

export const metadata: Metadata = { title: "Configurações" };

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function BlockError({ what }: { what: string }) {
  return (
    <p role="alert" className="rounded-card border px-5 py-6 text-center text-[0.8125rem] text-muted-foreground">
      Não foi possível carregar {what} agora. Recarregue a página.
    </p>
  );
}

export default async function Page() {
  const session = await requireManager();
  const [summary, billing, integrations] = await Promise.all([
    optional("configuracoes", getSettingsSummary()),
    optional("configuracoes", getBillingOverview()),
    optional("configuracoes", getIntegrations(session.clinic.id)),
  ]);

  const plan = billing.ok ? billing.value : null;
  const current = plan ? plan.plans.find((p) => p.id === plan.clinic.plan_id) : null;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="type-display">Configurações</h1>
        <p className="text-sm text-muted-foreground">Dados da clínica, equipe, tabelas e integrações.</p>
      </header>

      <div className="lg:hidden">
        <SettingsMenu withDescriptions />
      </div>

      {summary.ok ? (
        <KpiStrip
          label="Cadastros"
          items={[
            { label: "Unidades", value: summary.value.units, context: "ativas", href: "/configuracoes/unidades" },
            { label: "Profissionais", value: summary.value.professionals, context: plural(summary.value.chairs, "cadeira", "cadeiras"), href: "/configuracoes/profissionais" },
            {
              label: "Procedimentos",
              value: summary.value.procedures,
              context: summary.value.unpriced ? <span className="font-semibold text-warning">{plural(summary.value.unpriced, "sem preço", "sem preço")}</span> : "todos com preço",
              href: "/configuracoes/procedimentos",
            },
            { label: "Formas de pagamento", value: summary.value.paymentMethods, context: "ativas", href: "/configuracoes/formas-de-pagamento" },
          ]}
        />
      ) : (
        <BlockError what="os cadastros" />
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[18rem_minmax(0,1fr)] xl:items-start">
        {plan ? (
          <section aria-labelledby="seu-plano" className="space-y-3 rounded-card bg-brand-deep p-5 text-brand-deep-foreground">
            <h2 id="seu-plano" className="type-label text-brand-deep-foreground/70">
              Seu plano
            </h2>
            <p className="type-title">{current?.name ?? "Sem plano escolhido"}</p>
            <p className="text-[0.8125rem] text-brand-deep-foreground/80">
              {subscriptionStatusLabels[plan.clinic.subscription_status]}
              {plan.clinic.subscription_status === "trialing" && plan.clinic.trial_ends_at ? ` até ${formatDate(plan.clinic.trial_ends_at)}` : ""}
            </p>
            <dl className="space-y-1.5 border-t border-brand-deep-foreground/15 pt-3 text-[0.8125rem]">
              <div className="flex justify-between gap-2">
                <dt className="text-brand-deep-foreground/75">Unidades</dt>
                <dd className="font-semibold tabular-nums">
                  {plan.usage.units}
                  {current?.max_units ? ` de ${current.max_units}` : ""}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-brand-deep-foreground/75">Profissionais</dt>
                <dd className="font-semibold tabular-nums">
                  {plan.usage.professionals}
                  {current?.max_professionals ? ` de ${current.max_professionals}` : ""}
                </dd>
              </div>
            </dl>
            <Link href="/configuracoes/assinatura" className={buttonVariants({ variant: "on-dark", className: "w-full" })}>
              Ver planos
            </Link>
          </section>
        ) : (
          <BlockError what="o plano" />
        )}

        {integrations.ok ? (
          <section aria-labelledby="integracoes" className="space-y-2 rounded-card border bg-card p-4 sm:p-5">
            <h2 id="integracoes" className="type-section">
              Integrações
            </h2>
            <ul className="divide-y divide-border-soft">
              {integrations.value.map((i) => (
                <li key={i.name}>
                  <Link href={i.href} className="flex min-h-14 items-center justify-between gap-3 py-2 outline-none hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/40">
                    <span className="flex min-w-0 flex-col">
                      <span className="text-sm font-semibold">{i.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{i.detail}</span>
                    </span>
                    <StatusBadge tone={i.tone}>{i.status}</StatusBadge>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <BlockError what="as integrações" />
        )}
      </div>
    </div>
  );
}
