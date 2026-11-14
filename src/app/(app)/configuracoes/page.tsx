import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Settings, Users } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { requireManager } from "@/features/tenancy/guards";

export const metadata: Metadata = { title: "Configurações" };

export default async function Page() {
  await requireManager();

  return (
    <div className="space-y-8">
      <PageHeader title="Configurações" description="Dados da clínica, unidades e equipe." />

      <Link
        href="/configuracoes/membros"
        className="flex items-center gap-4 rounded-xl border p-5 transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
      >
        <span className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Users className="size-5" aria-hidden />
        </span>
        <span className="flex-1">
          <span className="block font-medium">Equipe</span>
          <span className="block text-sm text-muted-foreground">Convide pessoas e defina o papel de cada uma.</span>
        </span>
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
      </Link>

      <EmptyState
        icon={Settings}
        title="Outras configurações em breve"
        description="Unidades, profissionais, procedimentos e formas de pagamento serão configurados aqui."
      />
    </div>
  );
}
