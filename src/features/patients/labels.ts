import type { Database } from "@/lib/supabase/database.types";

export type PatientGender = Database["public"]["Enums"]["patient_gender"];

export const patientGenders = ["female", "male", "other", "not_informed"] as const satisfies readonly PatientGender[];

export const genderLabels: Record<PatientGender, string> = {
  female: "Feminino",
  male: "Masculino",
  other: "Outro",
  not_informed: "Prefere não informar",
};

export const PAGE_SIZE = 25;

/** Abas da ficha (slug vazio = Resumo). */
export const PATIENT_TABS = [
  { slug: "", label: "Resumo" },
  { slug: "dados", label: "Dados" },
  { slug: "anamnese", label: "Anamnese" },
  { slug: "odontograma", label: "Odontograma" },
  { slug: "evolucoes", label: "Evoluções" },
  { slug: "fichas", label: "Fichas" },
  { slug: "orcamentos", label: "Orçamentos" },
  { slug: "financeiro", label: "Financeiro" },
  { slug: "recibos", label: "Recibos" },
  { slug: "exames", label: "Exames" },
  { slug: "arquivos", label: "Arquivos" },
  { slug: "documentos", label: "Documentos" },
  { slug: "agendamentos", label: "Agendamentos" },
] as const;

export const maritalLabels: Record<"solteiro" | "casado" | "uniao_estavel" | "divorciado" | "viuvo", string> = {
  solteiro: "Solteiro(a)",
  casado: "Casado(a)",
  uniao_estavel: "União estável",
  divorciado: "Divorciado(a)",
  viuvo: "Viúvo(a)",
};

export const educationLabels: Record<"fundamental" | "medio" | "superior" | "pos" | "nao_informado", string> = {
  fundamental: "Fundamental",
  medio: "Médio",
  superior: "Superior",
  pos: "Pós-graduação",
  nao_informado: "Prefere não informar",
};
