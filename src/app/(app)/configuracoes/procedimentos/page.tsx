import type { Metadata } from "next";

import { SettingsHeader } from "@/components/layout/settings-header";
import { NewProcedureButton, ProceduresList } from "@/features/settings/components/procedures-manager";
import { listProcedures } from "@/features/settings/queries";
import { requireManager } from "@/features/tenancy/guards";

export const metadata: Metadata = { title: "Procedimentos" };

export default async function Page() {
  await requireManager();
  const procedures = await listProcedures();

  return (
    <div className="space-y-8">
      <SettingsHeader
        title="Procedimentos"
        description="Preço e duração de cada procedimento. Usados na agenda e nos orçamentos."
        actions={<NewProcedureButton />}
      />
      <ProceduresList procedures={procedures} />
    </div>
  );
}
