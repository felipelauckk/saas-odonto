import type { TemplateVariables } from "./types";

export const TEMPLATE_VARIABLES: { key: keyof TemplateVariables; label: string }[] = [
  { key: "paciente", label: "Primeiro nome do paciente" },
  { key: "clinica", label: "Nome da clínica" },
  { key: "data", label: "Data da consulta" },
  { key: "hora", label: "Hora da consulta" },
  { key: "profissional", label: "Profissional" },
];

/** Troca {{variavel}} pelo valor; variável desconhecida ou vazia some. */
export function renderTemplate(body: string, variables: TemplateVariables): string {
  return body
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => (variables as Record<string, string | undefined>)[key] ?? "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Telefone brasileiro (DDD + número) para o formato internacional do WhatsApp. */
export function toWhatsAppNumber(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (/^[1-9]{2}9?\d{8}$/.test(digits)) return `55${digits}`;
  if (/^55[1-9]{2}9?\d{8}$/.test(digits)) return digits;
  return null;
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}
