import type { Metadata } from "next";
import { Wallet } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Financeiro" };

export default function Page() {
  return (
    <div className="space-y-8">
      <PageHeader title="Financeiro" description="Contas a receber e caixa do dia." />
      <EmptyState
        icon={Wallet}
        title="Nada no financeiro ainda"
        description="Parcelas, recebimentos e caixa aparecerão aqui."
      />
    </div>
  );
}
