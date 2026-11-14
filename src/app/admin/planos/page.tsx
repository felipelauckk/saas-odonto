import { PageHeader } from "@/components/layout/page-header";
import { PlansAdmin } from "@/features/admin/components/plans-admin";
import { listPlansForAdmin } from "@/features/admin/queries";

export const metadata = { title: "Planos" };

export default async function Page() {
  const plans = await listPlansForAdmin();
  return (
    <div className="space-y-6">
      <PageHeader title="Planos" description="Preço e limites de cada plano do SaaS." />
      <PlansAdmin plans={plans} />
    </div>
  );
}
