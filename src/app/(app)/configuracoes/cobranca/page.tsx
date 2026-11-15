import type { Metadata } from "next";

import { SubpageHeader } from "@/components/layout/subpage-header";
import { ConnectionSetup, DunningSetup } from "@/features/charges/components/billing-setup";
import { requireManager } from "@/features/tenancy/guards";
import { isSecretsConfigured } from "@/lib/secrets";
import { getSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Cobrança online" };

export default async function Page() {
  const session = await requireManager();
  const supabase = await createClient();
  const [{ data: connection }, { data: steps }, site] = await Promise.all([
    supabase.from("clinic_billing").select("environment, api_key_hint, webhook_token, connected_at").eq("clinic_id", session.clinic.id).maybeSingle(),
    supabase.from("dunning_steps").select("id, offset_days, body, active").order("offset_days"),
    getSiteUrl(),
  ]);
  return (
    <div className="space-y-10">
      <SubpageHeader title="Cobrança online" description="Pix, boleto e link de pagamento pela conta Asaas da clínica, e régua de cobrança." backHref="/configuracoes" backLabel="Configurações" />
      <section className="space-y-3" aria-labelledby="asaas"><h2 id="asaas" className="text-base font-medium">Conta Asaas</h2><ConnectionSetup connection={connection} webhookUrl={`${site}/api/asaas/cobranca`} secretsReady={isSecretsConfigured()} /></section>
      <section className="space-y-3" aria-labelledby="regua"><h2 id="regua" className="text-base font-medium">Régua de cobrança</h2><DunningSetup steps={steps ?? []} /></section>
    </div>
  );
}
