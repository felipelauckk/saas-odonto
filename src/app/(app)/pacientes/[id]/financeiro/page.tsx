import type { Metadata } from "next";

import { logAccess } from "@/features/audit/log";
import { Wallet } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { isOnlineBillingEnabled, listCharges } from "@/features/charges/service";
import { getInvoicesInfo } from "@/features/invoices/queries";
import { NewReceivableButton } from "@/features/finance/components/new-receivable";
import { PatientFinanceActions, PatientFinanceExtras } from "@/features/finance/components/patient-finance-extras";
import { ReceivablesList } from "@/features/finance/components/receivables-list";
import { listActivePaymentMethods, listPatientReceivables } from "@/features/finance/queries";
import { getPatient } from "@/features/patients/queries";
import { requireClinic } from "@/features/tenancy/guards";
import { formatCurrency } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Financeiro" };

export default async function Page({ params }: PageProps<"/pacientes/[id]/financeiro">) {
  const session = await requireClinic();
  const { id } = await params;
  void logAccess("view", "receivables", id);
  const [receivables, paymentMethods, patient] = await Promise.all([listPatientReceivables(id), listActivePaymentMethods(), getPatient(id)]);
  const role = session.clinic.role;
  const canOperate = role !== "dentist";
  const [onlineEnabled, charges] = canOperate
    ? await Promise.all([isOnlineBillingEnabled(session.clinic.id), createClient().then((s) => listCharges(s, { patientId: id }))])
    : [false, []];
  const [{ data: subscriptions }, { data: credits }, { data: creditBalance }] = canOperate
    ? await createClient().then((s) =>
        Promise.all([
          s.from("patient_subscriptions").select("id, description, amount_cents, due_day, starts_on, ends_on, active").eq("patient_id", id).order("active", { ascending: false }).order("created_at", { ascending: false }),
          s.from("patient_credits").select("id, amount_cents, kind, notes, created_at").eq("patient_id", id).order("created_at", { ascending: false }).limit(30),
          s.rpc("patient_credit_balance", { _patient_id: id }),
        ]),
      )
    : [{ data: [] }, { data: [] }, { data: 0 }];
  const invoicesInfo = canOperate ? await getInvoicesInfo(session.clinic.id, receivables.filter((r) => r.status === "paid").map((r) => r.id)) : undefined;
  const pending = receivables.filter((r) => r.status === "open" || r.status === "overdue").reduce((s, r) => s + r.amount_cents, 0);
  const paid = receivables.filter((r) => r.status === "paid").reduce((s, r) => s + (r.paid_amount_cents ?? 0), 0);
  const newButton =
    canOperate && patient ? (
      <div className="flex flex-wrap gap-2">
        <PatientFinanceActions patientId={patient.id} canManage={role === "owner" || role === "manager"} />
        <NewReceivableButton patient={{ id: patient.id, name: patient.full_name, detail: null }} />
      </div>
    ) : null;
  const extras = <PatientFinanceExtras subscriptions={subscriptions ?? []} credits={credits ?? []} />;

  if (!receivables.length) {
    return (
      <div className="space-y-4">
        <EmptyState icon={Wallet} title="Nenhuma cobrança" description="Parcelas de orçamentos aprovados, mensalidades e cobranças avulsas aparecem aqui." action={newButton} />
        {extras}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          A receber: <span className="font-medium text-foreground tabular-nums">{formatCurrency(pending)}</span> · Pago:{" "}
          <span className="font-medium text-foreground tabular-nums">{formatCurrency(paid)}</span>
          {creditBalance ? (
            <>
              {" "}
              · Crédito: <span className="font-semibold text-success tabular-nums">{formatCurrency(creditBalance)}</span>
            </>
          ) : null}
        </p>
        {newButton}
      </div>
      <ReceivablesList
        receivables={receivables}
        paymentMethods={paymentMethods}
        canOperate={canOperate}
        canManage={role === "owner" || role === "manager"}
        showPatient={false}
        online={{ enabled: onlineEnabled, clinicName: session.clinic.name, charges }} invoices={invoicesInfo}
      />
      {extras}
    </div>
  );
}
