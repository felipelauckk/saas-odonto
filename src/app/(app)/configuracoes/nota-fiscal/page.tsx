import type { Metadata } from "next";

import { SubpageHeader } from "@/components/layout/subpage-header";
import { isOnlineBillingEnabled } from "@/features/charges/service";
import { FiscalSettingsForm } from "@/features/invoices/components/fiscal-settings-form";
import { requireManager } from "@/features/tenancy/guards";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Nota fiscal" };

export default async function Page() {
  const session = await requireManager();
  const supabase = await createClient();
  const [{ data: settings }, { data: clinic }, connected] = await Promise.all([
    supabase.from("clinic_fiscal_settings").select("*").eq("clinic_id", session.clinic.id).maybeSingle(),
    supabase.from("clinics").select("email").eq("id", session.clinic.id).single(),
    isOnlineBillingEnabled(session.clinic.id),
  ]);
  return (
    <div className="space-y-8">
      <SubpageHeader title="Nota fiscal (NFS-e)" description="Emissão de nota fiscal de serviço pela conta Asaas da clínica." backHref="/configuracoes" backLabel="Configurações" />
      <FiscalSettingsForm settings={settings ? { ...settings, iss_rate: Number(settings.iss_rate) } : null} email={clinic?.email ?? ""} connected={connected} />
    </div>
  );
}
