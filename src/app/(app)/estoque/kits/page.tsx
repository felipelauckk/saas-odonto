import type { Metadata } from "next";

import { SubpageHeader } from "@/components/layout/subpage-header";
import { KitsEditor } from "@/features/stock/components/kits-editor";
import { getKits } from "@/features/stock/queries";
import { requireClinic } from "@/features/tenancy/guards";
import { canManageClinic } from "@/features/tenancy/roles";

export const metadata: Metadata = { title: "Kits por procedimento" };

export default async function Page() {
  const session = await requireClinic();
  const data = await getKits();
  return (
    <div className="space-y-6">
      <SubpageHeader
        title="Kits por procedimento"
        description="Materiais baixados do estoque quando o procedimento é marcado como realizado."
        backHref="/estoque"
        backLabel="Estoque"
      />
      <KitsEditor {...data} canManage={canManageClinic(session.clinic.role)} />
    </div>
  );
}
