import type { Database } from "@/lib/supabase/database.types";

export type PatientSource = Database["public"]["Enums"]["patient_source"];
export type PatientGender = Database["public"]["Enums"]["patient_gender"];

export const patientSources = ["indicacao", "instagram", "google", "site", "outro"] as const satisfies readonly PatientSource[];
export const patientGenders = ["female", "male", "other", "not_informed"] as const satisfies readonly PatientGender[];

export const sourceLabels: Record<PatientSource, string> = {
  indicacao: "Indicação",
  instagram: "Instagram",
  google: "Google",
  site: "Site",
  outro: "Outro",
};

export const genderLabels: Record<PatientGender, string> = {
  female: "Feminino",
  male: "Masculino",
  other: "Outro",
  not_informed: "Prefere não informar",
};

export const PAGE_SIZE = 25;

/** Abas da ficha (slug vazio = Dados). */
export const PATIENT_TABS = [
  { slug: "", label: "Dados" },
  { slug: "anamnese", label: "Anamnese" },
  { slug: "odontograma", label: "Odontograma" },
  { slug: "evolucoes", label: "Evoluções" },
  { slug: "fichas", label: "Fichas" },
  { slug: "orcamentos", label: "Orçamentos" },
  { slug: "financeiro", label: "Financeiro" },
  { slug: "arquivos", label: "Arquivos" },
  { slug: "documentos", label: "Documentos" },
  { slug: "agendamentos", label: "Agendamentos" },
] as const;
