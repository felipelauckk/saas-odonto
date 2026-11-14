import type { Metadata } from "next";

import { SubpageHeader } from "@/components/layout/subpage-header";
import { ClinicForm } from "@/features/settings/components/clinic-form";
import { LogoForm } from "@/features/settings/components/logo-form";
import { getClinic } from "@/features/settings/queries";
import { requireManager } from "@/features/tenancy/guards";

export const metadata: Metadata = { title: "Clínica" };

export default async function Page() {
  await requireManager();
  const clinic = await getClinic();
  if (!clinic) return null;

  return (
    <div className="space-y-8">
      <SubpageHeader title="Clínica" description="Dados que aparecem em orçamentos, recibos e mensagens." />
      <section className="space-y-4 rounded-xl border p-5 sm:p-6" aria-labelledby="logo-titulo">
        <h2 id="logo-titulo" className="text-base font-medium">
          Logo
        </h2>
        <LogoForm logoUrl={clinic.logoSignedUrl} />
      </section>
      <section className="space-y-4 rounded-xl border p-5 sm:p-6" aria-labelledby="dados-titulo">
        <h2 id="dados-titulo" className="text-base font-medium">
          Dados da clínica
        </h2>
        <ClinicForm clinic={clinic} />
      </section>
    </div>
  );
}
