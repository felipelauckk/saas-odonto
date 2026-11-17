import Link from "next/link";
import { Pencil } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { formatIsoDate } from "@/lib/dates";
import { formatCpfCnpj, formatPhone } from "@/lib/documents";
import { formatDateTime } from "@/lib/format";

import { genderLabels, sourceLabels } from "../labels";
import type { Patient } from "../queries";

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

export function PatientDetails({ patient }: { patient: Patient }) {
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Link href={`/pacientes/${patient.id}/editar`} className={buttonVariants({ variant: "outline" })}>
          <Pencil aria-hidden />
          Editar dados
        </Link>
      </div>
      <section className="rounded-card border bg-card p-5 sm:p-6" aria-label="Dados pessoais">
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Item label="CPF" value={patient.cpf ? formatCpfCnpj(patient.cpf) : null} />
          <Item label="Data de nascimento" value={patient.birth_date ? formatIsoDate(patient.birth_date) : null} />
          <Item label="Gênero" value={patient.gender ? genderLabels[patient.gender] : null} />
          <Item label="Telefone" value={patient.phone ? formatPhone(patient.phone) : null} />
          <Item label="WhatsApp" value={patient.whatsapp ? formatPhone(patient.whatsapp) : null} />
          <Item label="E-mail" value={patient.email} />
          <Item label="Endereço" value={formatAddress(patient.address as Address | null)} wide />
          {patient.guardian_name ? (
            <>
              <Item label="Responsável legal" value={patient.guardian_name} />
              <Item label="CPF do responsável" value={patient.guardian_cpf ? formatCpfCnpj(patient.guardian_cpf) : null} />
            </>
          ) : null}
          <Item label="Como conheceu a clínica" value={patient.source ? sourceLabels[patient.source] : null} />
          <Item
            label="Consentimento LGPD"
            value={patient.consent_lgpd_at ? `Registrado em ${formatDateTime(patient.consent_lgpd_at)}` : "Não registrado"}
          />
          <Item label="Cadastrado em" value={formatDateTime(patient.created_at)} />
          {patient.notes ? (
            <Item label="Observações" value={patient.notes} wide />
          ) : null}
        </dl>
      </section>
    </div>
  );
}
