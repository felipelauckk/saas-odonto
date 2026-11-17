import type { Metadata } from "next";

import { SubpageHeader } from "@/components/layout/subpage-header";
import { AiSettings } from "@/features/ai/components/ai-settings";
import { requireManager } from "@/features/tenancy/guards";
import { aiFeatureLabels, isAiConfigured, type AiFeature } from "@/lib/ai/claude";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Inteligência artificial" };

const usd = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 });

export default async function Page() {
  const session = await requireManager();
  // Sem a chave da IA no servidor a seção some (primeira versão sem IA).
  if (!isAiConfigured()) redirect("/configuracoes");
  const supabase = await createClient();
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const [{ data: settings }, { data: usage }] = await Promise.all([
    supabase.from("clinic_ai_settings").select("*").eq("clinic_id", session.clinic.id).maybeSingle(),
    supabase.from("ai_usage_log").select("feature, cost_usd, input_tokens, output_tokens").gte("created_at", start.toISOString()).limit(20000),
  ]);
  const byFeature = new Map<AiFeature, { cost: number; calls: number }>();
  for (const u of usage ?? []) {
    const r = byFeature.get(u.feature) ?? { cost: 0, calls: 0 };
    r.cost += Number(u.cost_usd);
    r.calls++;
    byFeature.set(u.feature, r);
  }
  const total = [...byFeature.values()].reduce((s, r) => s + r.cost, 0);
  return (
    <div className="space-y-8">
      <SubpageHeader title="Inteligência artificial" description="Recursos com a IA do Claude: cada um é ligado à parte e todo uso fica registrado com o custo." backHref="/configuracoes" backLabel="Configurações" />
      {!isAiConfigured() ? (
        <p className="rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          A chave da API do Claude (ANTHROPIC_API_KEY) ainda não foi configurada no servidor: os recursos ficam indisponíveis até lá.
        </p>
      ) : null}
      <section className="space-y-2" aria-labelledby="uso">
        <h2 id="uso" className="text-base font-medium">Uso neste mês</h2>
        <p className="text-sm">
          Total: <strong className="tabular-nums">{usd.format(total)}</strong> de {usd.format(Number(settings?.monthly_limit_usd ?? 0))}
        </p>
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          {(Object.keys(aiFeatureLabels) as AiFeature[]).map((f) => (
            <li key={f} className="flex justify-between rounded-lg border px-3 py-2">
              <span>{aiFeatureLabels[f]}</span>
              <span className="tabular-nums text-muted-foreground">{byFeature.get(f)?.calls ?? 0} usos · {usd.format(byFeature.get(f)?.cost ?? 0)}</span>
            </li>
          ))}
        </ul>
      </section>
      {settings ? <AiSettings settings={{ ...settings, monthly_limit_usd: Number(settings.monthly_limit_usd) }} /> : <p className="text-sm text-muted-foreground">Configuração indisponível.</p>}
    </div>
  );
}
