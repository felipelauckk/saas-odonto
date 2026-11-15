import type { Metadata } from "next";

import { SubpageHeader } from "@/components/layout/subpage-header";
import { LabsSetup, NewLabButton } from "@/features/prosthetics/components/labs-setup";
import { listLabsSetup } from "@/features/prosthetics/queries";
import { requireManager } from "@/features/tenancy/guards";

export const metadata: Metadata = { title: "Laboratórios" };

export default async function Page() {
  await requireManager();
  const { labs, services } = await listLabsSetup();
  return (
    <div className="space-y-8">
      <SubpageHeader title="Laboratórios" description="Laboratórios de prótese e a tabela de preços e prazos de cada um." backHref="/configuracoes" backLabel="Configurações" actions={<NewLabButton />} />
      <LabsSetup labs={labs} services={services} />
    </div>
  );
}
