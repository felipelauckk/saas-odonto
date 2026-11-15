import type { Metadata } from "next";

import { SubpageHeader } from "@/components/layout/subpage-header";
import { CampaignsSetup, PartnersSetup, PublicFormSetup, StagesSetup } from "@/features/crm/components/crm-setup";
import { listStages } from "@/features/crm/queries";
import { requireManager } from "@/features/tenancy/guards";
import { getSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "CRM" };

export default async function Page() {
  const session = await requireManager();
  const supabase = await createClient();
  const [stages, { data: campaigns }, { data: partners }, { data: clinic }, site] = await Promise.all([
    listStages(),
    supabase.from("crm_campaigns").select("id, name, source, cost_cents, active").order("name"),
    supabase.from("referral_partners").select("id, name, phone, notes, active").order("name"),
    supabase.from("clinics").select("lead_form_token").eq("id", session.clinic.id).single(),
    getSiteUrl(),
  ]);
  return (
    <div className="space-y-10">
      <SubpageHeader title="CRM" description="Etapas do funil, campanhas, parceiros que indicam e formulário de captação." backHref="/configuracoes" backLabel="Configurações" />
      <section className="space-y-3" aria-labelledby="etapas"><h2 id="etapas" className="text-base font-medium">Etapas do funil</h2><StagesSetup stages={stages} /></section>
      <section className="space-y-3" aria-labelledby="campanhas"><h2 id="campanhas" className="text-base font-medium">Campanhas</h2><CampaignsSetup campaigns={campaigns ?? []} /></section>
      <section className="space-y-3" aria-labelledby="parceiros"><h2 id="parceiros" className="text-base font-medium">Parceiros que indicam</h2><PartnersSetup partners={partners ?? []} /></section>
      <section className="space-y-3" aria-labelledby="formulario"><h2 id="formulario" className="text-base font-medium">Formulário de captação</h2><PublicFormSetup url={`${site}/captacao/${clinic?.lead_form_token ?? ""}`} /></section>
    </div>
  );
}
