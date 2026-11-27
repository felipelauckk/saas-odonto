import type { Metadata } from "next";
import { PublicNotice, PublicShell } from "@/components/app/public-shell";
import { Link2Off } from "lucide-react";
import { z } from "zod";

import { PublicLeadForm } from "@/features/crm/components/public-lead-form";
import { loadLeadForm } from "@/features/crm/public-form";

import { submitPublicLead } from "./actions";

export const metadata: Metadata = { title: "Fale com a clínica", robots: { index: false, follow: false } };

export default async function Page({ params, searchParams }: PageProps<"/captacao/[token]">) {
  const { token } = await params;
  const query = await searchParams;
  const clinic = await loadLeadForm(token);
  // ?origem=<chave da origem> (instagram, google, site...); desconhecida vira "site".
  const source = z.string().regex(/^[a-z_]{2,20}$/).catch("site").parse(query.origem);
  const campaignId = z.uuid().nullable().catch(null).parse(query.campanha ?? null);

  return (
    <PublicShell clinicName={clinic?.name ?? null} width="sm">
      {clinic ? (
        <>
          <div className="space-y-1">
            <h1 className="type-title">Fale com a clínica</h1>
            <p className="text-sm text-muted-foreground">Deixe seu contato e a clínica fala com você.</p>
          </div>
          <PublicLeadForm token={token} source={source} campaignId={campaignId} action={submitPublicLead} />
        </>
      ) : (
        <PublicNotice icon={<Link2Off aria-hidden />} title="Formulário indisponível" />
      )}
    </PublicShell>
  );
}
