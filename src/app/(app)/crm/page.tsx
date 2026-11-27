import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3 } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { CrmBoard, NewLeadButton } from "@/features/crm/components/crm-board";
import { getCrmBoard } from "@/features/crm/queries";
import { getPatientSources } from "@/features/patients/queries";
import { requireFrontDesk } from "@/features/tenancy/guards";
import { todayIso } from "@/lib/dates";

export const metadata: Metadata = { title: "CRM" };

export default async function Page() {
  await requireFrontDesk();
  const [board, sources] = await Promise.all([getCrmBoard(todayIso()), getPatientSources()]);
  const options = { campaigns: board.campaigns, partners: board.partners, procedures: board.procedures, sources };
  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM"
        description="Funil de captação: de novo contato a paciente."
        actions={
          <div className="flex gap-2">
            <Link href="/crm/relatorio" className={buttonVariants({ variant: "outline" })}>
              <BarChart3 aria-hidden />
              Conversão
            </Link>
            <NewLeadButton options={options} />
          </div>
        }
      />
      <CrmBoard stages={board.stages} leads={board.leads} options={options} now={new Date().getTime()} />
    </div>
  );
}
