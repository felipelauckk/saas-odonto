import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { SubpageHeader } from "@/components/layout/subpage-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ProfessionalFormsMatrix } from "@/features/specialty/components/forms-setup";
import { getFormsSetup } from "@/features/specialty/queries";
import { requireManager } from "@/features/tenancy/guards";

export const metadata: Metadata = { title: "Fichas clínicas" };

export default async function Page() {
  await requireManager();
  const { templates, professionals, chosen } = await getFormsSetup();
  return (
    <div className="space-y-10">
      <SubpageHeader
        title="Fichas clínicas"
        description="Fichas por especialidade (ortodontia, implantes, endodontia, periodontia, harmonização) e quem usa cada uma."
        backHref="/configuracoes"
        backLabel="Configurações"
        actions={<Link href="/configuracoes/fichas/nova" className={buttonVariants()}><Plus aria-hidden />Nova ficha</Link>}
      />
      <section className="space-y-3" aria-labelledby="modelos">
        <h2 id="modelos" className="text-base font-medium">Modelos</h2>
        <ul className="divide-y rounded-xl border">
          {templates.map((t) => (
            <li key={t.id}>
              <Link href={`/configuracoes/fichas/${t.id}`} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/50 sm:px-5">
                <span className="flex-1 font-medium">{t.name}</span>
                <span className="text-muted-foreground">{t.fields.length} campos</span>
                {!t.active ? <Badge variant="secondary">Inativa</Badge> : null}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-3" aria-labelledby="quem-usa">
        <h2 id="quem-usa" className="text-base font-medium">Quem usa cada ficha</h2>
        <ProfessionalFormsMatrix templates={templates} professionals={professionals} chosen={chosen} />
      </section>
    </div>
  );
}
