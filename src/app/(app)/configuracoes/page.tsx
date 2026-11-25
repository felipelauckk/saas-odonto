import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CircleAlert } from "lucide-react";

import { StatusBadge } from "@/components/app/status-badge";
import { BlockError } from "@/components/feedback/block-error";
import { getBillingOverview } from "@/features/billing/queries";
import { subscriptionStatusLabels } from "@/features/billing/labels";
import { SettingsAreaList } from "@/features/settings/components/settings-area-list";
import { getIntegrations, getSettingsSummary, type IntegrationStatus } from "@/features/settings/queries";
import { settingsTodo } from "@/features/settings/todo";
import { requireManager } from "@/features/tenancy/guards";
import { isAiConfigured } from "@/lib/ai/claude";
import { formatDate } from "@/lib/format";
import { optional } from "@/lib/optional";
import type { StatusTone } from "@/lib/status-tones";

export const metadata: Metadata = { title: "Configurações" };

const PLAN_TONE: Record<string, StatusTone> = { trialing: "info", active: "success", past_due: "danger", canceled: "neutral" };

export default async function Page() {
  const session = await requireManager();
  const [summary, billing, integrations] = await Promise.all([
    optional("configuracoes", getSettingsSummary()),
    optional("configuracoes", getBillingOverview()),
    optional("configuracoes", getIntegrations(session.clinic.id)),
  ]);

  const plan = billing.ok ? billing.value : null;
  const current = plan ? plan.plans.find((p) => p.id === plan.clinic.plan_id) : null;
  const todo = settingsTodo(
    summary.ok ? summary.value : null,
    plan ? { planId: plan.clinic.plan_id, status: plan.clinic.subscription_status, trialEndsAt: plan.clinic.trial_ends_at } : null,
  );

  const status: (Omit<IntegrationStatus, "tone"> & { tone: StatusTone })[] = [];
  if (plan) {
    const s = plan.clinic.subscription_status;
    status.push({
      name: current ? `Plano ${current.name}` : "Plano",
      detail:
        s === "trialing" && plan.clinic.trial_ends_at
          ? `${current ? "Teste" : "Nenhum plano escolhido · teste"} até ${formatDate(plan.clinic.trial_ends_at)}`
          : current
            ? "Assinatura da clínica"
            : "Nenhum plano escolhido",
      status: subscriptionStatusLabels[s] ?? s,
      tone: PLAN_TONE[s] ?? "neutral",
      href: "/configuracoes/assinatura",
    });
  }
  if (integrations.ok) status.push(...integrations.value);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="type-display">Configurações</h1>
        <p className="text-sm text-muted-foreground">Informações e preferências da sua clínica. Escolha uma área para ajustar.</p>
      </header>

      {!summary.ok ? (
        <BlockError what="as pendências" />
      ) : todo.length ? (
        <section aria-labelledby="pendencias" className="space-y-3 rounded-card border bg-card p-4 shadow-card sm:p-5">
          <h2 id="pendencias" className="type-section">
            O que falta configurar
          </h2>
          <ul aria-label="O que falta configurar" className="divide-y">
            {todo.map((t) => (
              <li key={t.href}>
                <Link
                  href={t.href}
                  className="group flex min-h-11 items-center gap-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-tint-peach text-tint-peach-foreground" aria-hidden>
                    <CircleAlert className="size-3.5" strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1">{t.text}</span>
                  <span className="flex shrink-0 items-center gap-1 font-semibold text-primary group-hover:underline">
                    Resolver
                    <ArrowRight className="size-3.5" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <SettingsAreaList aiEnabled={isAiConfigured()} />

      <section aria-labelledby="situacao" className="space-y-2.5">
        <h2 id="situacao" className="type-label text-muted-foreground">
          Plano e integrações
        </h2>
        {status.length ? (
          <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-card border bg-border shadow-card sm:grid-cols-2">
            {status.map((i) => (
              <li key={i.name} className="bg-card">
                <Link
                  href={i.href}
                  className="flex h-full flex-col gap-2 p-4 outline-none transition-colors hover:bg-accent/30 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:ring-inset"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{i.name}</span>
                    <StatusBadge tone={i.tone}>{i.status}</StatusBadge>
                  </span>
                  <span className="text-xs text-muted-foreground">{i.detail}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <BlockError what="o plano e as integrações" />
        )}
      </section>
    </div>
  );
}
