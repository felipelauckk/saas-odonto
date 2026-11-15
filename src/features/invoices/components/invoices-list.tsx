"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { FileText, MessageCircle } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { FormMessage } from "@/components/forms/form-message";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { firstName, toWhatsAppNumber } from "@/lib/messaging/render";

import { cancelInvoiceAction } from "../actions";
import { invoiceStatusLabels, type InvoiceStatus } from "../logic";

export type InvoiceRow = {
  id: string;
  status: InvoiceStatus;
  number: string | null;
  amount_cents: number;
  description: string;
  pdf_url: string | null;
  error: string | null;
  created_at: string;
  issued_at: string | null;
  patient_id: string;
  patients: { full_name: string; whatsapp: string | null; phone: string | null } | null;
};

export function InvoicesList({ invoices, clinicName, canManage }: { invoices: InvoiceRow[]; clinicName: string; canManage: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (!invoices.length) return <EmptyState icon={FileText} title="Nenhuma nota no período" description="As notas aparecem aqui ao emitir pelo recebimento (Contas a receber > pago > Emitir NFS-e)." />;
  return (
    <div className="space-y-3">
      {error ? <FormMessage state={{ status: "error", message: error }} /> : null}
      <ul className="divide-y rounded-xl border">
        {invoices.map((n) => {
          const wa = toWhatsAppNumber(n.patients?.whatsapp ?? n.patients?.phone);
          const text = `Olá, ${firstName(n.patients?.full_name ?? "")}! Segue a nota fiscal de ${formatCurrency(n.amount_cents)} da ${clinicName}: ${n.pdf_url}`;
          return (
            <li key={n.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
              <div className="min-w-0 flex-1">
                <Link href={`/pacientes/${n.patient_id}/financeiro`} className="font-medium hover:underline">{n.patients?.full_name}</Link>
                <p className="truncate text-sm text-muted-foreground">{n.number ? `Nº ${n.number} · ` : ""}{n.description}</p>
                <p className="text-sm text-muted-foreground">{formatDateTime(n.issued_at ?? n.created_at)}</p>
                {n.status === "error" && n.error ? <p className="text-sm text-destructive">{n.error}</p> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={n.status === "error" ? "destructive" : n.status === "authorized" ? "default" : "secondary"}>{invoiceStatusLabels[n.status]}</Badge>
                <span className="text-sm font-medium tabular-nums">{formatCurrency(n.amount_cents)}</span>
                {n.pdf_url ? <a href={n.pdf_url} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>PDF</a> : null}
                {n.pdf_url && wa ? (
                  <a href={`https://wa.me/${wa}?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
                    <MessageCircle aria-hidden />
                    Enviar
                  </a>
                ) : null}
                {canManage && (n.status === "authorized" || n.status === "processing" || n.status === "error") ? (
                  <Button variant="ghost" size="sm" disabled={pending} onClick={() => startTransition(async () => {
                    const r = await cancelInvoiceAction(n.id);
                    setError(r.error ?? null);
                  })}>Cancelar</Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
