import type { Metadata } from "next";
import { Printer, ReceiptText } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Recibos" };

/** Recibos emitidos: cada parcela paga tem o seu, que se reimprime daqui. */
export default async function Page({ params }: PageProps<"/pacientes/[id]/recibos">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("receivables")
    .select("id, description, paid_amount_cents, paid_at, payment_methods(name)")
    .eq("patient_id", id)
    .eq("status", "paid")
    .not("paid_at", "is", null)
    .order("paid_at", { ascending: false });
  if (error) throw error;

  if (!data.length) {
    return <EmptyState icon={ReceiptText} title="Nenhum recibo" description="Quando uma cobrança do paciente for paga, o recibo aparece aqui para reimprimir." />;
  }

  return (
    <div className="overflow-hidden rounded-card border bg-card shadow-card">
      <ul className="divide-y" aria-label="Recibos do paciente">
        {data.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{r.description}</p>
              <p className="text-xs text-muted-foreground">
                Pago em {formatDate(r.paid_at!)}
                {r.payment_methods?.name ? ` · ${r.payment_methods.name}` : ""}
              </p>
            </div>
            <span className="text-sm font-semibold tabular-nums">{formatCurrency(r.paid_amount_cents ?? 0)}</span>
            <a href={`/financeiro/recibo/${r.id}`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Printer aria-hidden />
              Reimprimir
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
