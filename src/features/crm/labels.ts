import type { Database } from "@/lib/supabase/database.types";

export type LeadSource = Database["public"]["Enums"]["lead_source"];
export type StageKind = Database["public"]["Enums"]["crm_stage_kind"];
type PatientSource = Database["public"]["Enums"]["patient_source"];

export const leadSources: readonly LeadSource[] = ["instagram", "google", "indicacao", "site", "anuncio", "passante", "outro"];

export const sourceLabels: Record<LeadSource, string> = {
  instagram: "Instagram",
  google: "Google",
  indicacao: "Indicação",
  site: "Site",
  anuncio: "Anúncio",
  passante: "Passante",
  outro: "Outro",
};

/** Origem do lead → origem do paciente (o cadastro de paciente tem menos opções). */
export const patientSourceFor: Record<LeadSource, PatientSource> = {
  instagram: "instagram",
  google: "google",
  indicacao: "indicacao",
  site: "site",
  anuncio: "outro",
  passante: "outro",
  outro: "outro",
};
