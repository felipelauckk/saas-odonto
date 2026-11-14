import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { cn } from "cn";

import { EmptyState } from "@/components/feedback/empty-state";
import { SubpageHeader } from "@/components/layout/subpage-header";
import { AUDIT_ACTION_LABELS, AUDIT_TABLE_LABELS, listAuditLog } from "@/features/audit/queries";
import { requireManager } from "@/features/tenancy/guards";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Auditoria" };

export default async function Page({ searchParams }: PageProps<"/configuracoes/auditoria">) {
  await requireManager();
  const { acao } = await searchParams;
  const action = typeof acao === "string" && acao in AUDIT_ACTION_LABELS ? acao : null;
  const rows = await listAuditLog({ action });

  return (
    <div className="space-y-6">
      <SubpageHeader title="Auditoria" description="Quem abriu ou alterou prontuário, orçamentos e financeiro. Os registros não podem ser apagados." />
      <nav className="flex flex-wrap gap-2" aria-label="Filtrar por ação">
        {[["", "Tudo"], ...Object.entries(AUDIT_ACTION_LABELS)].map(([value, label]) => (
          <Link
            key={value}
            href={value ? `/configuracoes/auditoria?acao=${value}` : "/configuracoes/auditoria"}
            aria-current={(action ?? "") === value ? "page" : undefined}
            className={cn(
              "inline-flex h-8 items-center rounded-full border px-3 text-sm pointer-coarse:h-11",
              (action ?? "") === value ? "border-primary bg-primary/10" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
      {rows.length ? (
        <ul className="divide-y rounded-xl border">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-col gap-0.5 px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:gap-4 sm:px-5">
              <span className="w-36 shrink-0 text-muted-foreground tabular-nums">{formatDateTime(r.at)}</span>
              <span className="min-w-0 flex-1">
                <span className="font-medium">{r.userName}</span> {(AUDIT_ACTION_LABELS[r.action] ?? r.action).toLowerCase()}{" "}
                {(AUDIT_TABLE_LABELS[r.table_name] ?? r.table_name).toLowerCase()}
                {r.patientName && r.patient_id ? (
                  <>
                    {" "}de{" "}
                    <Link href={`/pacientes/${r.patient_id}`} className="underline-offset-4 hover:underline">
                      {r.patientName}
                    </Link>
                  </>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={ShieldCheck} title="Nenhum registro" description="Aberturas e alterações do prontuário, orçamentos e financeiro aparecem aqui." />
      )}
      <p className="text-xs text-muted-foreground">Mostrando os 200 registros mais recentes.</p>
    </div>
  );
}
