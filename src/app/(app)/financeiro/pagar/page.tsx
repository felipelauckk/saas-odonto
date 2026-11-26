import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Receipt } from "lucide-react";
import { cn } from "cn";

import { EmptyState } from "@/components/feedback/empty-state";
import { listActivePaymentMethods } from "@/features/finance/queries";
import { NewPayableButton } from "@/features/payables/components/new-payable";
import { PayablesList } from "@/features/payables/components/payables-list";
import { listFinanceSetup, listPayables, PAYABLE_FILTERS, type PayableFilter } from "@/features/payables/queries";
import { requireClinic } from "@/features/tenancy/guards";
import { canManageClinic } from "@/features/tenancy/roles";
import { formatCurrency } from "@/lib/format";

export const metadata: Metadata = { title: "Contas a pagar" };

export default async function Page({ searchParams }: PageProps<"/financeiro/pagar">) {
  const session = await requireClinic();
  if (!canManageClinic(session.clinic.role)) redirect("/financeiro");
  const { status } = await searchParams;
  const filter = (typeof status === "string" && status in PAYABLE_FILTERS ? status : "abertas") as PayableFilter;
  const [rows, setup, paymentMethods] = await Promise.all([listPayables(filter), listFinanceSetup(), listActivePaymentMethods()]);
  const total = rows.reduce((s, r) => s + (r.paid_amount_cents ?? r.amount_cents), 0);
  const active = (list: { id: string; name: string; active: boolean }[]) => list.filter((x) => x.active).map(({ id, name }) => ({ id, name }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex flex-wrap gap-2" aria-label="Situação">
          {(Object.entries(PAYABLE_FILTERS) as [PayableFilter, { label: string }][]).map(([key, f]) => (
            <Link
              key={key}
              href={key === "abertas" ? "/financeiro/pagar" : `/financeiro/pagar?status=${key}`}
              aria-current={filter === key ? "page" : undefined}
              className={cn("inline-flex h-8 items-center rounded-full border px-3 text-sm pointer-coarse:h-11", filter === key ? "border-foreground bg-foreground font-semibold text-background" : "text-muted-foreground hover:bg-muted")}
            >
              {f.label}
            </Link>
          ))}
        </nav>
        <NewPayableButton
          categories={active(setup.categories.filter((c) => c.type === "expense"))}
          suppliers={active(setup.suppliers)}
          costCenters={active(setup.costCenters)}
          paymentMethods={paymentMethods}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        Total da lista: <span className="font-medium text-foreground tabular-nums">{formatCurrency(total)}</span>
      </p>
      {rows.length ? (
        <PayablesList rows={rows} paymentMethods={paymentMethods} />
      ) : (
        <EmptyState icon={Receipt} title="Nenhuma conta aqui" description="Aluguel, salários, fornecedores e outras despesas da clínica." />
      )}
    </div>
  );
}
