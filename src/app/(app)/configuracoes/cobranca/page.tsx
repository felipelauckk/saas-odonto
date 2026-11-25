import type { Metadata } from "next";

import { FormSection, FormSections } from "@/components/forms/form-sections";
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
    <div className="space-y-8">
      <SubpageHeader title="Cobrança online" description="Pix, boleto e link de pagamento pela conta Asaas da clínica, e régua de cobrança." backHref="/configuracoes" backLabel="Configurações" />
      <FormSections>
        <FormSection id="asaas" title="Conta Asaas" description="O dinheiro das cobranças vai direto para a conta da clínica.">
          <ConnectionSetup connection={connection} webhookUrl={`${site}/api/asaas/cobranca`} secretsReady={isSecretsConfigured()} />
        </FormSection>
        <FormSection id="regua" title="Régua de cobrança" description="Mensagens pelo WhatsApp antes e depois do vencimento de cada parcela.">
          <DunningSetup steps={steps ?? []} />
        </FormSection>
      </FormSections>
    </div>
  );
}
