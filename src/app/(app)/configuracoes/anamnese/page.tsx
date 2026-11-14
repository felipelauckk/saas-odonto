import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { SubpageHeader } from "@/components/layout/subpage-header";
import { TemplateEditor } from "@/features/clinical/components/template-editor";
import { getDefaultTemplate } from "@/features/clinical/queries";
import { requireManager } from "@/features/tenancy/guards";

export const metadata: Metadata = { title: "Modelo de anamnese" };

export default async function Page() {
  await requireManager();
  const template = await getDefaultTemplate();

  return (
    <div className="space-y-8">
      <SubpageHeader
        title="Modelo de anamnese"
        description="Perguntas feitas ao paciente. Respostas “sim” nas perguntas de alerta aparecem em destaque na ficha."
      />
      {template ? (
        <TemplateEditor templateId={template.id} initial={template.questions} />
      ) : (
        <EmptyState icon={ClipboardList} title="Nenhum modelo de anamnese" />
      )}
    </div>
  );
}
