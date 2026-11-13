import type { Metadata } from "next";
import { Settings } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Configurações" };

export default function Page() {
  return (
    <div className="space-y-8">
      <PageHeader title="Configurações" description="Dados da clínica, unidades e equipe." />
      <EmptyState
        icon={Settings}
        title="Configurações em breve"
        description="Unidades, profissionais, procedimentos e formas de pagamento serão configurados aqui."
      />
    </div>
  );
}
