import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import { z } from "zod";

import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { StockView } from "@/features/stock/components/stock-view";
import { getStockData } from "@/features/stock/queries";
import { requireClinic } from "@/features/tenancy/guards";
import { canManageClinic } from "@/features/tenancy/roles";
import { todayIso } from "@/lib/dates";

export const metadata: Metadata = { title: "Estoque" };

export default async function Page({ searchParams }: PageProps<"/estoque">) {
  const session = await requireClinic();
  const tab = z.enum(["saldo", "validade", "compras", "movimentos"]).catch("saldo").parse((await searchParams).aba);
  const unit = session.activeUnit;
  if (!unit) return <EmptyState icon={MapPin} title="Nenhuma unidade disponível" />;
  const data = await getStockData();
  return (
    <div className="space-y-6">
      <PageHeader title="Estoque" description={session.units.length > 1 ? `Saldo da unidade ${unit.name}.` : "Materiais, validade e lista de compras."} />
      <StockView
        tab={tab}
        unitId={unit.id}
        units={session.units.map((u) => ({ id: u.id, name: u.name }))}
        {...data}
        today={todayIso()}
        canManage={canManageClinic(session.clinic.role)}
        canOperate={session.clinic.role !== "dentist"}
      />
    </div>
  );
}
