import type { Metadata } from "next";

import { SubpageHeader } from "@/components/layout/subpage-header";
import { NewUnitButton, UnitsList } from "@/features/settings/components/units-manager";
import { listUnits } from "@/features/settings/queries";
import { requireManager } from "@/features/tenancy/guards";

export const metadata: Metadata = { title: "Unidades" };

export default async function Page() {
  await requireManager();
  const units = await listUnits();

  return (
    <div className="space-y-8">
      <SubpageHeader
        title="Unidades"
        description="Com mais de uma unidade ativa, aparece um seletor de unidade no topo do sistema."
        actions={<NewUnitButton />}
      />
      <UnitsList units={units} />
    </div>
  );
}
