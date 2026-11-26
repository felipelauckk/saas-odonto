import Link from "next/link";
import { CalendarPlus, ChevronLeft, FileDown, FileText, MessageCircle, Phone } from "lucide-react";

import { StatusBadge } from "@/components/app/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { ageFromBirthDate, formatIsoDate } from "@/lib/dates";
import { formatPhone } from "@/lib/documents";
import { initials } from "@/lib/initials";

import { sourceLabels } from "../labels";
import type { Patient } from "../queries";
import { MINOR_AGE } from "../schemas";
import { patientSince } from "../summary";
import { ArchiveButton } from "./archive-button";

type Props = {
  patient: Patient;
  canExport?: boolean;
  portal?: React.ReactNode;
};

/** Topo da ficha: avatar, nome, dados de contato e as ações mais usadas. */
export function PatientHeader({ patient, canExport = false, portal = null }: Props) {
  const age = patient.birth_date ? ageFromBirthDate(patient.birth_date) : null;
  const contact = patient.whatsapp ?? patient.phone;
  const archived = Boolean(patient.archived_at);

  return (
    <div className="space-y-4">
      <Link
        href="/pacientes"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground pointer-coarse:min-h-11"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Pacientes
      </Link>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span
            aria-hidden
            className="flex size-14 shrink-0 items-center justify-center rounded-avatar bg-accent text-xl font-black text-accent-foreground sm:size-[4.5rem] sm:text-2xl"
          >
            {initials(patient.full_name)}
          </span>
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="type-display break-words">{patient.full_name}</h1>
              {archived ? <StatusBadge tone="neutral">Arquivado</StatusBadge> : null}
              {age !== null && age < MINOR_AGE ? <StatusBadge tone="info">Menor de idade</StatusBadge> : null}
            </div>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem] text-muted-foreground">
              {age !== null && patient.birth_date ? (
                <span>
                  {age} {age === 1 ? "ano" : "anos"} · {formatIsoDate(patient.birth_date)}
                </span>
              ) : null}
              {patient.phone ? (
                <a href={`tel:+55${patient.phone}`} className="inline-flex items-center gap-1 hover:text-foreground pointer-coarse:min-h-11">
                  <Phone className="size-3.5" aria-hidden />
                  {formatPhone(patient.phone)}
                </a>
              ) : null}
              <span>
                Paciente desde {patientSince(patient.created_at)}
                {patient.source ? ` · ${sourceLabels[patient.source].toLowerCase()}` : ""}
              </span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {contact ? (
            <a href={`https://wa.me/55${contact}`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline" })}>
              <MessageCircle className="text-success" aria-hidden />
              WhatsApp
            </a>
          ) : null}
          <Link href={`/pacientes/${patient.id}/documentos`} className={buttonVariants({ variant: "outline" })}>
            <FileText aria-hidden />
            Documentos
          </Link>
          {archived ? null : (
            <Link href={`/agenda?paciente=${patient.id}`} className={buttonVariants()}>
              <CalendarPlus aria-hidden />
              Agendar
            </Link>
          )}
          {/* Ações menos usadas: depois das principais no celular, antes delas no desktop. */}
          <div className="flex flex-wrap gap-2 lg:-order-1">
            {canExport ? (
              <a
                href={`/pacientes/${patient.id}/exportar`}
                className={buttonVariants({ variant: "outline" })}
                title="Todos os dados do paciente em PDF (direito de acesso da LGPD)"
              >
                <FileDown aria-hidden />
                Exportar dados
              </a>
            ) : null}
            {portal}
            <ArchiveButton patientId={patient.id} archived={archived} name={patient.full_name} />
          </div>
        </div>
      </div>
    </div>
  );
}
