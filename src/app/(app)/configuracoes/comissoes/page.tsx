import type { Metadata } from "next";

import { SubpageHeader } from "@/components/layout/subpage-header";
import { CommissionSettingsForm, ProfessionalCommission } from "@/features/commissions/components/commission-setup";
import { getCommissionSettings, listCommissionSetup } from "@/features/commissions/queries";
import { requireManager } from "@/features/tenancy/guards";

export const metadata: Metadata = { title: "Comissões" };

export default async function Page() {
  await requireManager();
  const [settings, setup] = await Promise.all([getCommissionSettings(), listCommissionSetup()]);
  return (
    <div className="space-y-8">
      <SubpageHeader title="Comissões" description="Como a comissão de cada profissional é calculada." />
      <section className="space-y-3 rounded-xl border p-5" aria-labelledby="base">
        <h2 id="base" className="text-base font-medium">Base de cálculo da clínica</h2>
        <CommissionSettingsForm initial={settings} />
      </section>
      <section className="space-y-3" aria-labelledby="profs">
        <h2 id="profs" className="text-base font-medium">Por profissional</h2>
        <p className="text-sm text-muted-foreground">A exceção do procedimento vale antes da exceção da categoria, que vale antes do percentual padrão.</p>
        {setup.professionals.filter((p) => p.active).map((p) => (
          <ProfessionalCommission
            key={p.id}
            professional={{ id: p.id, name: p.name, commission_percent: p.commission_percent === null ? null : Number(p.commission_percent) }}
            rules={setup.rules.filter((r) => r.professional_id === p.id).map((r) => ({ ...r, percent: r.percent === null ? null : Number(r.percent) }))}
            procedures={setup.procedures}
            categories={setup.categories}
          />
        ))}
      </section>
    </div>
  );
}
