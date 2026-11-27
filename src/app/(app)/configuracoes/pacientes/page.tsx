import type { Metadata } from "next";

import { FormSection, FormSections } from "@/components/forms/form-sections";
import { SubpageHeader } from "@/components/layout/subpage-header";
import { RegistrySettings, SourcesManager } from "@/features/patients/components/patient-settings";
import { getPatientSources } from "@/features/patients/queries";
import { requireManager } from "@/features/tenancy/guards";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Pacientes e captação" };

export default async function Page() {
  const session = await requireManager();
  const supabase = await createClient();
  const [sources, { data: clinic, error }] = await Promise.all([
    getPatientSources(),
    supabase.from("clinics").select("patient_record_auto, patient_record_next, require_patient_email").eq("id", session.clinic.id).single(),
  ]);
  if (error) throw error;
  return (
    <div className="space-y-8">
      <SubpageHeader
        title="Pacientes e captação"
        description="Origens (como o paciente conheceu a clínica), número de prontuário e o que o cadastro exige."
        backHref="/configuracoes"
        backLabel="Configurações"
      />
      <FormSections>
        <FormSection
          id="origens"
          title="Origens"
          description="Aparecem no cadastro, no CRM, no filtro de Pacientes e nos relatórios. Desativar tira dos cadastros novos sem apagar dos antigos."
        >
          <SourcesManager sources={sources} />
        </FormSection>
        <RegistrySettings initial={{ recordAuto: clinic.patient_record_auto, recordNext: clinic.patient_record_next, requireEmail: clinic.require_patient_email }} />
      </FormSections>
    </div>
  );
}
