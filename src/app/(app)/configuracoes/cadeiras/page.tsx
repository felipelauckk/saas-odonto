import type { Metadata } from "next";

import { SubpageHeader } from "@/components/layout/subpage-header";
import { ChairsList, NewChairButton } from "@/features/settings/components/chairs-manager";
import { listChairs, listUnits } from "@/features/settings/queries";
import { getSessionContext } from "@/features/tenancy/queries";
import { requireManager } from "@/features/tenancy/guards";

export const metadata: Metadata = { title: "Cadeiras" };

export default async function Page() {
  await requireManager();
  const [chairs, units, session] = await Promise.all([listChairs(), listUnits(), getSessionContext()]);

  return (
    <div className="space-y-8">
      <SubpageHeader
        title="Cadeiras"
        description="Cada cadeira pertence a uma unidade."
        actions={<NewChairButton units={units} unitId={session?.activeUnit?.id} />}
      />
      <ChairsList chairs={chairs} units={units} />
    </div>
  );
}
