import type { Metadata } from "next";
import { Clock, Link2Off } from "lucide-react";

import { PublicNotice, PublicShell } from "@/components/app/public-shell";
import { PublicSigningForm } from "@/features/documents/components/public-signing-form";
import { loadPublicSigning } from "@/features/documents/signing";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Assinatura de documento", robots: { index: false, follow: false } };

export default async function Page({ params }: PageProps<"/assinar/[token]">) {
  const { token } = await params;
  const signing = await loadPublicSigning(token);

  if (signing.state !== "ok") {
    // Mensagem neutra: nenhum dado do paciente, nem se o link existiu.
    const expired = signing.state === "expired";
    return (
      <PublicShell clinicName={null} width="lg">
        <PublicNotice
          icon={expired ? <Clock aria-hidden /> : <Link2Off aria-hidden />}
          title={expired ? "Este link expirou" : signing.state === "used" ? "Este link já foi usado" : "Link indisponível"}
        >
          Peça um novo link para a clínica.
        </PublicNotice>
      </PublicShell>
    );
  }

  return (
    <PublicShell
      clinicName={signing.clinicName}
      detail="Link seguro para assinatura"
      width="lg"
      footer="Registramos data, hora, endereço IP e um código único do documento. Seus dados ficam protegidos pela LGPD."
    >
      <div className="space-y-1.5">
        <h1 className="type-title">{signing.purpose === "document" ? signing.document!.title : "Anamnese"}</h1>
        <p className="text-xs text-muted-foreground">Link válido até {formatDateTime(signing.expiresAt)}.</p>
      </div>
      {signing.document ? (
        <article className="max-h-[55dvh] overflow-y-auto rounded-card border bg-card p-5 text-sm leading-relaxed whitespace-pre-line" tabIndex={0} aria-label="Texto do documento">
          {signing.document.body}
        </article>
      ) : (
        <p className="text-sm text-muted-foreground">Responda as perguntas abaixo. Elas ajudam o dentista a cuidar de você com segurança.</p>
      )}
      <div className="rounded-card border bg-card p-4 sm:p-5">
        <PublicSigningForm token={token} purpose={signing.purpose} questions={signing.anamnesis?.questions ?? null} />
      </div>
    </PublicShell>
  );
}
