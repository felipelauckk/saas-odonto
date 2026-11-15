import { PageHeader } from "@/components/layout/page-header";
import { FinanceTabs } from "@/features/finance/components/finance-tabs";
import { requireClinic } from "@/features/tenancy/guards";

export default async function FinanceLayout({ children }: LayoutProps<"/financeiro">) {
  const session = await requireClinic();
  const isDentist = session.clinic.role === "dentist";
  return (
    <div className="space-y-6">
      <PageHeader title="Financeiro" description={isDentist ? "Seus recebimentos." : "Receber, pagar, caixa e resultados."} />
      <FinanceTabs showCash={!isDentist} showManagement={session.clinic.role === "owner" || session.clinic.role === "manager"} />
      {children}
    </div>
  );
}
