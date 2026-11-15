import type { Database } from "@/lib/supabase/database.types";

export type DocumentKind = Database["public"]["Enums"]["document_kind"];
export type DocumentStatus = Database["public"]["Enums"]["document_status"];

export const documentKinds = [
  "prescription",
  "special_prescription",
  "certificate",
  "attendance",
  "contract",
  "consent",
  "post_op",
  "other",
] as const satisfies readonly DocumentKind[];

export const documentKindLabels: Record<DocumentKind, string> = {
  prescription: "Receituário",
  special_prescription: "Receituário de controle especial",
  certificate: "Atestado",
  attendance: "Declaração de comparecimento",
  contract: "Contrato",
  consent: "Termo de consentimento",
  post_op: "Orientações pós-operatórias",
  other: "Outro",
};

/** Mesma regra da função is_clinical_document no banco. */
export const CLINICAL_KINDS: readonly DocumentKind[] = ["prescription", "special_prescription", "certificate"];
export const PRESCRIPTION_KINDS: readonly DocumentKind[] = ["prescription", "special_prescription"];

export const documentStatusLabels: Record<DocumentStatus, string> = {
  issued: "Emitido",
  signed: "Assinado",
  canceled: "Cancelado",
};

export const DEFAULT_SIGNATURE_DAYS = 7;
