import type { Metadata } from "next";

import { SubpageHeader } from "@/components/layout/subpage-header";
import { NewProfessionalButton, ProfessionalsList } from "@/features/settings/components/professionals-manager";
import { listLinkableMembers, listProfessionals } from "@/features/settings/queries";
import { requireManager } from "@/features/tenancy/guards";

export const metadata: Metadata = { title: "Profissionais" };

export default async function Page() {
  await requireManager();
  const [professionals, members] = await Promise.all([listProfessionals(), listLinkableMembers()]);

  return (
    <div className="space-y-8">
      <SubpageHeader
        title="Profissionais"
        description="Quem atende na clínica, com cor na agenda e horários."
        actions={<NewProfessionalButton members={members} />}
      />
      <ProfessionalsList professionals={professionals} />
    </div>
  );
}
