import type { Metadata } from "next";

import { SubpageHeader } from "@/components/layout/subpage-header";
import { MedicationsManager, TemplatesManager } from "@/features/documents/components/templates-manager";
import { VerifyForm } from "@/features/documents/components/verify-form";
import { listDocumentTemplates, listMedications } from "@/features/documents/queries";
import { requireManager } from "@/features/tenancy/guards";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Documentos" };

export default async function Page() {
  await requireManager();
  const supabase = await createClient();
  const [templates, medications, { data: procedures }] = await Promise.all([
    listDocumentTemplates(),
    listMedications(true),
    supabase.from("procedures").select("id, name").eq("active", true).order("name"),
  ]);
  return (
    <div className="space-y-10">
      <SubpageHeader
        title="Documentos"
        description="Modelos de receitas, atestados, contratos e termos, e a lista de medicamentos. Revise os textos padrão com o advogado ou o CRO da clínica."
      />
      <section className="space-y-3" aria-labelledby="modelos">
        <h2 id="modelos" className="text-base font-medium">Modelos</h2>
        <TemplatesManager templates={templates} procedures={procedures ?? []} />
      </section>
      <section className="space-y-3" aria-labelledby="medicamentos">
        <h2 id="medicamentos" className="text-base font-medium">Medicamentos</h2>
        <MedicationsManager medications={medications} />
      </section>
      <section className="space-y-3 rounded-xl border p-5" aria-labelledby="verificar">
        <h2 id="verificar" className="text-base font-medium">Verificar documento</h2>
        <p className="text-sm text-muted-foreground">Envie um PDF para conferir se ele é exatamente o que a clínica emitiu ou o que o paciente assinou.</p>
        <VerifyForm />
      </section>
    </div>
  );
}
