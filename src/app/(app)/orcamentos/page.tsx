import type { Metadata } from "next";
import { FileText } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Orçamentos" };

export default function Page() {
  return (
    <div className="space-y-8">
      <PageHeader title="Orçamentos" description="Planos de tratamento e aprovações." />
      <EmptyState
        icon={FileText}
        title="Nenhum orçamento por enquanto"
        description="Os orçamentos poderão ser montados a partir do odontograma."
      />
    </div>
  );
}
