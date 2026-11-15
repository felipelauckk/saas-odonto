import type { Metadata } from "next";
import { Link2Off } from "lucide-react";
import { z } from "zod";

import { leadSources, type LeadSource } from "@/features/crm/labels";
import { PublicLeadForm } from "@/features/crm/components/public-lead-form";
import { loadLeadForm } from "@/features/crm/public-form";

import { submitPublicLead } from "./actions";

export const metadata: Metadata = { title: "Fale com a clínica", robots: { index: false, follow: false } };

export default async function Page({ params, searchParams }: PageProps<"/captacao/[token]">) {
  const { token } = await params;
  const query = await searchParams;
  const clinic = await loadLeadForm(token);
  const source = z.enum(leadSources as [LeadSource, ...LeadSource[]]).catch("site").parse(query.origem);
  const campaignId = z.uuid().nullable().catch(null).parse(query.campanha ?? null);

  return (
    <div className="min-h-full bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-md space-y-6">
        {clinic ? (
          <>
            <div className="space-y-1">
              <h1 className="text-xl font-semibold tracking-tight">{clinic.name}</h1>
              <p className="text-sm text-muted-foreground">Deixe seu contato e a clínica fala com você.</p>
            </div>
            <PublicLeadForm token={token} source={source} campaignId={campaignId} action={submitPublicLead} />
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-xl border p-8 text-center">
            <Link2Off className="size-8 text-muted-foreground" aria-hidden />
            <h1 className="text-lg font-medium">Formulário indisponível</h1>
          </div>
        )}
      </div>
    </div>
  );
}
