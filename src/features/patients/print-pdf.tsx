import "server-only";

import { formatIsoDate } from "@/lib/dates";
import { formatCpfCnpj, formatPhone } from "@/lib/documents";
import { formatDateTime } from "@/lib/format";
import { renderReportPdf, type PdfBlock, type PdfLetterhead } from "@/lib/pdf/report-pdf";

import { formatAddress, type PatientAddress } from "./address";
import { educationLabels, genderLabels, maritalLabels } from "./labels";
import type { Patient } from "./queries";

const phone = (v: string | null) => (v ? formatPhone(v) : null);

/** Cadastro do paciente em PDF (mesmos blocos da aba Dados). */
export async function renderPatientDataPdf(p: Patient, letterhead: PdfLetterhead): Promise<Buffer> {
  const blocks: PdfBlock[] = [
    {
      kind: "fields",
      title: "Identificação",
      fields: [
        ["Nome completo", p.full_name],
        ["Como prefere ser chamado", p.nickname],
        ["Nº de prontuário", p.record_number],
        ["Nascimento", p.birth_date ? formatIsoDate(p.birth_date) : null],
        ["Gênero", p.gender ? genderLabels[p.gender] : null],
        ["CPF", p.cpf ? formatCpfCnpj(p.cpf) : null],
        ["RG", p.rg],
        ["Estado civil", p.marital_status ? maritalLabels[p.marital_status as keyof typeof maritalLabels] : null],
        ["Escolaridade", p.education ? educationLabels[p.education as keyof typeof educationLabels] : null],
      ],
    },
    {
      kind: "fields",
      title: "Contato",
      fields: [
        ["Celular", phone(p.phone)],
        ["WhatsApp", phone(p.whatsapp)],
        ["Telefone fixo", phone(p.landline)],
        ...p.patient_phones.map((t): [string, string | null] => [t.label ? `Telefone: ${t.label}` : "Outro telefone", phone(t.number)]),
        ["E-mail", p.no_email ? "Não tem e-mail" : p.email],
        ["Instagram", p.instagram ? `@${p.instagram}` : null],
        ["Endereço", formatAddress(p.address as PatientAddress | null)],
      ],
    },
  ];
  if (p.guardian_name || p.father_name || p.mother_name) {
    blocks.push({
      kind: "fields",
      title: "Responsável e família",
      fields: [
        ["Responsável", p.guardian_name ? `${p.guardian_name}${p.guardian_relationship ? ` (${p.guardian_relationship})` : ""}` : null],
        ["CPF do responsável", p.guardian_cpf ? formatCpfCnpj(p.guardian_cpf) : null],
        ["Telefone do responsável", phone(p.guardian_phone)],
        ["Pai", p.father_name],
        ["Mãe", p.mother_name],
      ],
    });
  }
  blocks.push({
    kind: "fields",
    title: "Outros dados",
    fields: [
      ["Profissão", p.occupation],
      ["Local de trabalho", p.workplace],
      ["Origem", p.patient_sources?.name ?? null],
      ["Indicado por", p.referrer_name ?? p.referral_partners?.name ?? null],
      ["Observações", p.notes],
      ["Consentimento LGPD", p.consent_lgpd_at ? formatDateTime(p.consent_lgpd_at) : "Não registrado"],
      ["Cadastrado em", formatDateTime(p.created_at)],
    ],
  });
  return renderReportPdf({ letterhead, title: "Cadastro do paciente", subtitle: p.full_name, blocks });
}
