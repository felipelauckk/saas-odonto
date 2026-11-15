import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Landmark } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { Badge } from "@/components/ui/badge";
import { OfxImport, ReconcileActions } from "@/features/payables/components/ofx-import";
import { getReconciliation } from "@/features/payables/queries";
import { requireClinic } from "@/features/tenancy/guards";
import { canManageClinic } from "@/features/tenancy/roles";
import { formatIsoDate } from "@/lib/dates";
import { formatCurrency } from "@/lib/format";

export const metadata: Metadata = { title: "Conciliação" };

export default async function Page() {
  const session = await requireClinic();
  if (!canManageClinic(session.clinic.role)) redirect("/financeiro");
  const { transactions, suggestions } = await getReconciliation();
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <OfxImport />
        <p className="text-sm text-muted-foreground">Baixe o extrato em OFX no internet banking. O sistema sugere o recebimento ou pagamento correspondente; você confirma.</p>
      </div>
      {transactions.length ? (
        <ul className="divide-y rounded-xl border">
          {transactions.map((t) => {
            const s = suggestions.get(t.id);
            return (
              <li key={t.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{t.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatIsoDate(t.posted_on)}
                    {t.account_label ? ` · ${t.account_label}` : ""}
                  </p>
                </div>
                <span className={`w-28 text-right text-sm font-medium tabular-nums ${t.amount_cents < 0 ? "text-destructive" : "text-emerald-700 dark:text-emerald-400"}`}>
                  {formatCurrency(t.amount_cents)}
                </span>
                {t.status === "unmatched" ? (
                  <ReconcileActions bankId={t.id} suggestion={s && s.kind !== "cash" ? { id: s.id, kind: s.kind, label: s.label } : null} />
                ) : (
                  <Badge variant={t.status === "matched" ? "default" : "secondary"}>{t.status === "matched" ? "Conciliado" : "Ignorado"}</Badge>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={Landmark} title="Nenhum extrato importado" />
      )}
    </div>
  );
}
