import type { Metadata } from "next";

import { SubpageHeader } from "@/components/layout/subpage-header";
import { CategoriesSetup, CostCentersSetup, SuppliersSetup } from "@/features/payables/components/finance-setup";
import { listFinanceSetup } from "@/features/payables/queries";
import { requireManager } from "@/features/tenancy/guards";

export const metadata: Metadata = { title: "Cadastros financeiros" };

export default async function Page() {
  await requireManager();
  const { categories, suppliers, costCenters } = await listFinanceSetup();
  return (
    <div className="space-y-10">
      <SubpageHeader title="Cadastros financeiros" description="Categorias de receitas e despesas, fornecedores e centros de custo." />
      <section className="space-y-3" aria-labelledby="cat"><h2 id="cat" className="text-base font-medium">Categorias</h2><CategoriesSetup categories={categories} /></section>
      <section className="space-y-3" aria-labelledby="forn"><h2 id="forn" className="text-base font-medium">Fornecedores</h2><SuppliersSetup suppliers={suppliers} /></section>
      <section className="space-y-3" aria-labelledby="cc"><h2 id="cc" className="text-base font-medium">Centros de custo</h2><CostCentersSetup costCenters={costCenters} /></section>
    </div>
  );
}
