import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Agenda" };

export default function Page() {
  return (
    <div className="space-y-8">
      <PageHeader title="Agenda" description="Consultas por profissional e cadeira." />
      <EmptyState
        icon={CalendarDays}
        title="A agenda ainda não está disponível"
        description="Em breve você poderá marcar e acompanhar as consultas por aqui."
      />
    </div>
  );
}
