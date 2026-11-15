import type { Metadata } from "next";
import { Clock, Link2Off } from "lucide-react";

import { Brand } from "@/components/layout/brand";
import { PublicSigningForm } from "@/features/documents/components/public-signing-form";
import { loadPublicSigning } from "@/features/documents/signing";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Assinatura de documento", robots: { index: false, follow: false } };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full bg-muted/40 px-4 py-8">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <Brand />
        {children}
      </div>
    </div>
  );
}

export default async function Page({ params }: PageProps<"/assinar/[token]">) {
  const { token } = await params;
  const signing = await loadPublicSigning(token);

  if (signing.state !== "ok") {
    // Mensagem neutra: nenhum dado do paciente, nem se o link existiu.
    const expired = signing.state === "expired";
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-background p-8 text-center">
          {expired ? <Clock className="size-8 text-muted-foreground" aria-hidden /> : <Link2Off className="size-8 text-muted-foreground" aria-hidden />}
          <h1 className="text-lg font-medium">{expired ? "Este link expirou" : signing.state === "used" ? "Este link já foi usado" : "Link indisponível"}</h1>
          <p className="text-sm text-muted-foreground">Peça um novo link para a clínica.</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">{signing.clinicName}</p>
        <h1 className="text-xl font-semibold tracking-tight">{signing.purpose === "document" ? signing.document!.title : "Anamnese"}</h1>
        <p className="text-xs text-muted-foreground">Link válido até {formatDateTime(signing.expiresAt)}.</p>
      </div>
      {signing.document ? (
        <article className="whitespace-pre-line rounded-xl border bg-background p-5 text-sm leading-relaxed">{signing.document.body}</article>
      ) : (
        <p className="text-sm text-muted-foreground">Responda as perguntas abaixo. Elas ajudam o dentista a cuidar de você com segurança.</p>
      )}
      <div className="rounded-xl bg-background">
        <PublicSigningForm token={token} purpose={signing.purpose} questions={signing.anamnesis?.questions ?? null} />
      </div>
    </Shell>
  );
}
