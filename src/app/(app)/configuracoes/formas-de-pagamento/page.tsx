import type { Metadata } from "next";

import { SettingsHeader } from "@/components/layout/settings-header";
import { NewPaymentMethodButton, PaymentMethodsList } from "@/features/settings/components/payment-methods-manager";
import { listPaymentMethods } from "@/features/settings/queries";
import { requireManager } from "@/features/tenancy/guards";

export const metadata: Metadata = { title: "Formas de pagamento" };

export default async function Page() {
  await requireManager();
  const methods = await listPaymentMethods();

  return (
    <div className="space-y-8">
      <SettingsHeader
        title="Formas de pagamento"
        description="A taxa e o prazo são usados no financeiro para calcular o valor líquido e a data de recebimento."
        actions={<NewPaymentMethodButton />}
      />
      <PaymentMethodsList methods={methods} />
    </div>
  );
}
