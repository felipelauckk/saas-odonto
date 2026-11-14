import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Clock } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { PATIENT_TABS } from "@/features/patients/labels";

export const metadata: Metadata = { title: "Paciente" };

/** Abas que ainda não têm conteúdo (cada uma ganha a própria rota na sua etapa). */
const UPCOMING: Record<string, string> = {
  anamnese: "A anamnese do paciente, com alertas de alergias e doenças, chega com o prontuário.",
  odontograma: "O odontograma, com os 32 dentes permanentes e 20 decíduos, chega com o prontuário.",
  evolucoes: "As evoluções clínicas chegam com o prontuário.",
  orcamentos: "Os orçamentos e planos de tratamento chegam em uma próxima etapa.",
  financeiro: "Parcelas e pagamentos do paciente chegam com o módulo financeiro.",
  arquivos: "Fotos e radiografias chegam com o prontuário.",
};

export default async function Page({ params }: PageProps<"/pacientes/[id]/[aba]">) {
  const { aba } = await params;
  const tab = PATIENT_TABS.find((t) => t.slug === aba);
  const description = UPCOMING[aba];
  if (!tab || !description) notFound();

  return <EmptyState icon={Clock} title={`${tab.label} em breve`} description={description} />;
}
