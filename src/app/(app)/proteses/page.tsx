import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { ProstheticsBoard } from "@/features/prosthetics/components/prosthetics-board";
import { getProstheticsBoard } from "@/features/prosthetics/queries";
import { canManageClinic } from "@/features/tenancy/roles";
import { requireClinic } from "@/features/tenancy/guards";
import { todayIso } from "@/lib/dates";

export const metadata: Metadata = { title: "Próteses" };

export default async function Page() {
  const session = await requireClinic();
  const today = todayIso();
  const { orders, labs, services, professionals } = await getProstheticsBoard(today);
  return (
    <div className="space-y-6">
      <PageHeader title="Próteses e alinhadores" description="Ordens de serviço do laboratório por etapa." />
      <ProstheticsBoard orders={orders} options={{ labs, services, professionals }} today={today} canManage={canManageClinic(session.clinic.role)} />
    </div>
  );
}
