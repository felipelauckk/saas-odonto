import type { Metadata } from "next";
import { Users } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Pacientes" };

export default function Page() {
  return (
    <div className="space-y-8">
      <PageHeader title="Pacientes" description="Cadastro e ficha dos pacientes." />
      <EmptyState
        icon={Users}
        title="Nenhum paciente por enquanto"
        description="O cadastro de pacientes chega em uma próxima etapa."
      />
    </div>
  );
}
