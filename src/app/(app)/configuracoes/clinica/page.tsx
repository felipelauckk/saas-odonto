import type { Metadata } from "next";

import { FormSection, FormSections } from "@/components/forms/form-sections";
import { SubpageHeader } from "@/components/layout/subpage-header";
import { ClinicForm } from "@/features/settings/components/clinic-form";
import { LogoForm } from "@/features/settings/components/logo-form";
import { getClinic } from "@/features/settings/queries";
import { requireManager } from "@/features/tenancy/guards";

export const metadata: Metadata = { title: "Dados da clínica" };

export default async function Page() {
  await requireManager();
  const clinic = await getClinic();
  if (!clinic) return null;

  return (
    <div className="space-y-8">
      <SubpageHeader title="Dados da clínica" description="Nome, documento, logo e contato." />
      <FormSections>
        <FormSection id="clinica-logo" title="Logo" description="Vai no topo das receitas, atestados, orçamentos e recibos.">
          <LogoForm logoUrl={clinic.logoSignedUrl} />
        </FormSection>
        <ClinicForm clinic={clinic} />
      </FormSections>
    </div>
  );
}
