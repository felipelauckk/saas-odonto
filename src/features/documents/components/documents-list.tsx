"use client";

import { useState, useTransition } from "react";
import { FileDown, FileSignature, XCircle } from "lucide-react";

import { FormMessage } from "@/components/forms/form-message";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";

import { cancelDocument, revokeSigningLink } from "../actions";
import { documentKindLabels, documentStatusLabels, type DocumentKind, type DocumentStatus } from "../labels";
import { SendLinkDialog } from "./send-link-dialog";

type Doc = { id: string; kind: DocumentKind; title: string; status: DocumentStatus; issued_at: string; professionals: { name: string } | null };
type Request = { id: string; purpose: "document" | "anamnesis"; document_id: string | null; status: "pending" | "signed" | "revoked"; expires_at: string; signed_at: string | null; signer_name: string | null; created_at: string };

type Props = { patientId: string; documents: Doc[]; requests: Request[] };

export function DocumentsList({ patientId, documents, requests }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const now = new Date().toISOString();
  const run = (fn: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const r = await fn();
      if (r.error) setError(r.error);
    });

  const anamnesisRequests = requests.filter((r) => r.purpose === "anamnesis");

  return (
    <div className="space-y-4">
      {error ? <FormMessage state={{ status: "error", message: error }} /> : null}
      <ul className="divide-y rounded-xl border" aria-busy={pending}>
        {documents.map((d) => {
          const reqs = requests.filter((r) => r.document_id === d.id);
          const signed = reqs.find((r) => r.status === "signed");
          const waiting = reqs.find((r) => r.status === "pending" && r.expires_at > now);
          return (
            <li key={d.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {d.title}
                  <Badge variant={d.status === "signed" ? "default" : d.status === "canceled" ? "secondary" : "outline"}>{documentStatusLabels[d.status]}</Badge>
                </p>
                <p className="text-sm text-muted-foreground">
                  {documentKindLabels[d.kind]} · {formatDateTime(d.issued_at)}
                  {d.professionals?.name ? ` · ${d.professionals.name}` : ""}
                </p>
                {signed ? (
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">
                    Assinado por {signed.signer_name} em {formatDateTime(signed.signed_at!)}
                  </p>
                ) : waiting ? (
                  <p className="text-sm text-muted-foreground">Aguardando assinatura · link vale até {formatDateTime(waiting.expires_at)}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <a href={`/documentos/${d.id}/arquivo`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  <FileDown aria-hidden />
                  PDF
                </a>
                {signed ? (
                  <a href={`/documentos/${signed.id}/arquivo?versao=assinado`} target="_blank" rel="noreferrer" className={buttonVariants({ size: "sm" })}>
                    <FileSignature aria-hidden />
                    PDF assinado
                  </a>
                ) : null}
                {d.status === "issued" ? (
                  <>
                    <SendLinkDialog patientId={patientId} documentId={d.id} label={d.title} triggerLabel={waiting ? "Novo link" : "Enviar para assinar"} />
                    {waiting ? (
                      <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => revokeSigningLink(waiting.id))}>
                        Revogar link
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => {
                        if (window.confirm(`Cancelar "${d.title}"? O documento fica no histórico como cancelado.`)) run(() => cancelDocument(d.id));
                      }}
                    >
                      <XCircle aria-hidden />
                      Cancelar
                    </Button>
                  </>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {anamnesisRequests.length ? (
        <section className="space-y-2" aria-labelledby="anamneses-link">
          <h2 id="anamneses-link" className="text-sm font-medium text-muted-foreground">
            Anamneses enviadas por link
          </h2>
          <ul className="divide-y rounded-xl border text-sm">
            {anamnesisRequests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-5">
                <span>
                  Enviada em {formatDateTime(r.created_at)} ·{" "}
                  {r.status === "signed"
                    ? `preenchida por ${r.signer_name} em ${formatDateTime(r.signed_at!)}`
                    : r.status === "revoked"
                      ? "revogada"
                      : r.expires_at > now
                        ? `aguardando (vale até ${formatDateTime(r.expires_at)})`
                        : "expirada"}
                </span>
                {r.status === "signed" ? (
                  <a href={`/documentos/${r.id}/arquivo?versao=assinado`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
                    PDF assinado
                  </a>
                ) : r.status === "pending" && r.expires_at > now ? (
                  <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => revokeSigningLink(r.id))}>
                    Revogar
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
