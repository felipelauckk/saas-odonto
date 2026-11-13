import type { Metadata } from "next";
import { LayoutDashboard } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Painel" };

export default function Page() {
  return (
    <div className="space-y-8">
      <PageHeader title="Painel" description="Visão geral da clínica." />
      <EmptyState
        icon={LayoutDashboard}
        title="Os indicadores aparecerão aqui"
        description="Consultas do dia, faturamento e valores a receber, assim que os módulos estiverem prontos."
      />
    </div>
  );
}
