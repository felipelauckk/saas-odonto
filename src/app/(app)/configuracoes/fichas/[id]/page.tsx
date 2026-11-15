import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SubpageHeader } from "@/components/layout/subpage-header";
import { TemplateBuilder } from "@/features/specialty/components/forms-setup";
import { listTemplates } from "@/features/specialty/queries";
import { requireManager } from "@/features/tenancy/guards";

export const metadata: Metadata = { title: "Editar ficha" };

export default async function Page({ params }: PageProps<"/configuracoes/fichas/[id]">) {
  await requireManager();
  const { id } = await params;
  const template = id === "nova" ? undefined : (await listTemplates()).find((t) => t.id === id);
  if (id !== "nova" && !template) notFound();
  return (
    <div className="space-y-6">
      <SubpageHeader title={template ? template.name : "Nova ficha"} description="Campos da ficha. Mudanças valem para as próximas versões preenchidas." backHref="/configuracoes/fichas" backLabel="Fichas clínicas" />
      <TemplateBuilder template={template} />
    </div>
  );
}
