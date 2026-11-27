import Link from "next/link";
import { Pencil } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { formatIsoDate } from "@/lib/dates";
import { formatCpfCnpj, formatPhone } from "@/lib/documents";
import { formatDateTime } from "@/lib/format";

import { educationLabels, genderLabels, maritalLabels } from "../labels";
import type { Patient } from "../queries";
import { PatientHistoryButton } from "./patient-history";

type Address = { cep?: string | null; street?: string | null; number?: string | null; complement?: string | null; district?: string | null; city?: string | null; state?: string | null };

function Item({ label, value, wide = false }: { label: string; value: string | null | undefined; wide?: boolean }) {
  return (
    <div className={wide ? "space-y-0.5 sm:col-span-2 lg:col-span-3" : "space-y-0.5"}>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value || <span className="text-muted-foreground">Não informado</span>}</dd>
    </div>
  );
}

function formatAddress(a: Address | null) {
  if (!a) return null;
  const line1 = [[a.street, a.number].filter(Boolean).join(", "), a.complement].filter(Boolean).join(" - ");
  const line2 = [a.district, [a.city, a.state].filter(Boolean).join("/")].filter(Boolean).join(" · ");
  const cep = a.cep ? `CEP ${a.cep.replace(/(\d{5})(\d{3})/, "$1-$2")}` : null;
  return [line1, line2, cep].filter(Boolean).join(" · ") || null;
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="border-t py-5 first:border-t-0 md:grid md:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] md:gap-8">
      <h2 className="type-section mb-3 md:mb-0">{title}</h2>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</dl>
    </section>
  );
}

const countryLabel = (code: string | null) => (code && code !== "55" ? `+${code} ` : "");

export function PatientDetails({ patient, photo }: { patient: Patient; photo?: React.ReactNode }) {
  const referredBy = patient.referrer_name ?? patient.referral_partners?.name ?? null;
  const hasFamily = Boolean(patient.guardian_name || patient.father_name || patient.mother_name);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <PatientHistoryButton patientId={patient.id} />
        <Link href={`/pacientes/${patient.id}/editar`} className={buttonVariants({ variant: "outline" })}>
          <Pencil aria-hidden />
          Editar dados
        </Link>
      </div>
      <div className="rounded-card border bg-card px-5 shadow-card sm:px-6">
        <Group title="Identificação">
          {photo ? <div className="sm:col-span-2 lg:col-span-3">{photo}</div> : null}
          <Item label="Nome completo" value={patient.full_name} />
          <Item label="Como prefere ser chamado" value={patient.nickname} />
          <Item label="Nº de prontuário" value={patient.record_number} />
          <Item label="Data de nascimento" value={patient.birth_date ? formatIsoDate(patient.birth_date) : null} />
          <Item label="Gênero" value={patient.gender ? genderLabels[patient.gender] : null} />
          <Item label="CPF" value={patient.cpf ? formatCpfCnpj(patient.cpf) : null} />
          <Item label="RG" value={patient.rg} />
          <Item label="Estado civil" value={patient.marital_status ? maritalLabels[patient.marital_status as keyof typeof maritalLabels] : null} />
          <Item label="Escolaridade" value={patient.education ? educationLabels[patient.education as keyof typeof educationLabels] : null} />
        </Group>
        <Group title="Contato">
          <Item label="Celular" value={patient.phone ? `${countryLabel(patient.phone_country)}${formatPhone(patient.phone)}` : null} />
          <Item label="WhatsApp" value={patient.whatsapp ? formatPhone(patient.whatsapp) : null} />
          <Item label="Telefone fixo" value={patient.landline ? formatPhone(patient.landline) : null} />
          {patient.patient_phones.map((p) => (
            <Item key={p.id} label={p.label ? `Telefone: ${p.label}` : "Outro telefone"} value={formatPhone(p.number)} />
          ))}
          <Item label="E-mail" value={patient.no_email ? "Não tem e-mail" : patient.email} />
          <Item label="Instagram" value={patient.instagram ? `@${patient.instagram}` : null} />
          <Item label="Facebook" value={patient.facebook} />
          <Item label="Falar com" value={patient.preferred_contact === "guardian" ? "Responsável" : "Paciente"} />
        </Group>
        <Group title="Endereço">
          <Item label="Endereço" value={formatAddress(patient.address as Address | null)} wide />
        </Group>
        {hasFamily ? (
          <Group title="Responsável e família">
            <Item label="Responsável" value={patient.guardian_name ? `${patient.guardian_name}${patient.guardian_relationship ? ` (${patient.guardian_relationship})` : ""}` : null} />
            <Item label="CPF do responsável" value={patient.guardian_cpf ? formatCpfCnpj(patient.guardian_cpf) : null} />
            <Item label="RG do responsável" value={patient.guardian_rg} />
            <Item label="Nascimento do responsável" value={patient.guardian_birth_date ? formatIsoDate(patient.guardian_birth_date) : null} />
            <Item label="Telefone do responsável" value={patient.guardian_phone ? formatPhone(patient.guardian_phone) : null} />
            <Item label="Pai" value={patient.father_name} />
            <Item label="Mãe" value={patient.mother_name} />
          </Group>
        ) : null}
        <Group title="Trabalho">
          <Item label="Profissão" value={patient.occupation} />
          <Item label="Local de trabalho" value={patient.workplace} />
        </Group>
        <Group title="Como conheceu">
          <Item label="Origem" value={patient.patient_sources?.name ?? null} />
          <Item label="Indicado por" value={referredBy} />
        </Group>
        <Group title="Observações e LGPD">
          <Item label="Observações" value={patient.notes} wide />
          <Item label="Consentimento LGPD" value={patient.consent_lgpd_at ? `Registrado em ${formatDateTime(patient.consent_lgpd_at)}` : "Não registrado"} />
          <Item label="Cadastrado em" value={formatDateTime(patient.created_at)} />
        </Group>
      </div>
    </div>
  );
}
