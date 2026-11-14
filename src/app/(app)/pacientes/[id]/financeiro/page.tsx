import type { Metadata } from "next";

import { logAccess } from "@/features/audit/log";
import { Wallet } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { NewReceivableButton } from "@/features/finance/components/new-receivable";
import { ReceivablesList } from "@/features/finance/components/receivables-list";
import { listActivePaymentMethods, listPatientReceivables } from "@/features/finance/queries";
import { getPatient } from "@/features/patients/queries";
import { requireClinic } from "@/features/tenancy/guards";
import { formatCurrency } from "@/lib/format";

export const metadata: Metadata = { title: "Financeiro" };

export default async function Page({ params }: PageProps<"/pacientes/[id]/financeiro">) {
  const session = await requireClinic();
  const { id } = await params;
  void logAccess("view", "receivables", id);
  const [receivables, paymentMethods, patient] = await Promise.all([listPatientReceivables(id), listActivePaymentMethods(), getPatient(id)]);
  const role = session.clinic.role;
  const canOperate = role !== "dentist";
  const pending = receivables.filter((r) => r.status === "open" || r.status === "overdue").reduce((s, r) => s + r.amount_cents, 0);
  const paid = receivables.filter((r) => r.status === "paid").reduce((s, r) => s + (r.paid_amount_cents ?? 0), 0);
  const newButton = canOperate && patient ? <NewReceivableButton patient={{ id: patient.id, name: patient.full_name, detail: null }} /> : null;

  if (!receivables.length) {
    return <EmptyState icon={Wallet} title="Nenhuma cobrança" description="Parcelas de orçamentos aprovados e cobranças avulsas aparecem aqui." action={newButton} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          A receber: <span className="font-medium text-foreground tabular-nums">{formatCurrency(pending)}</span> · Pago:{" "}
          <span className="font-medium text-foreground tabular-nums">{formatCurrency(paid)}</span>
        </p>
        {newButton}
      </div>
      <ReceivablesList
        receivables={receivables}
        paymentMethods={paymentMethods}
        canOperate={canOperate}
        canManage={role === "owner" || role === "manager"}
        showPatient={false}
      />
    </div>
  );
}
