import Link from "next/link";
import { ChevronLeft, MessageCircle, Phone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ageFromBirthDate, formatIsoDate } from "@/lib/dates";
import { formatPhone } from "@/lib/documents";

import type { Patient } from "../queries";
import { MINOR_AGE } from "../schemas";
import { ArchiveButton } from "./archive-button";

export function PatientHeader({ patient }: { patient: Patient }) {
  const age = patient.birth_date ? ageFromBirthDate(patient.birth_date) : null;
  const contact = patient.whatsapp ?? patient.phone;

  return (
    <div className="space-y-3">
      <Link
        href="/pacientes"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground pointer-coarse:min-h-11"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Pacientes
      </Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{patient.full_name}</h1>
            {patient.archived_at ? <Badge variant="secondary">Arquivado</Badge> : null}
            {age !== null && age < MINOR_AGE ? <Badge variant="outline">Menor de idade</Badge> : null}
          </div>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {age !== null && patient.birth_date ? (
              <span>
                {age} {age === 1 ? "ano" : "anos"} · nasceu em {formatIsoDate(patient.birth_date)}
              </span>
            ) : null}
            {patient.phone ? (
              <a href={`tel:+55${patient.phone}`} className="inline-flex items-center gap-1 hover:text-foreground">
                <Phone className="size-3.5" aria-hidden />
                {formatPhone(patient.phone)}
              </a>
            ) : null}
            {contact ? (
              <a
                href={`https://wa.me/55${contact}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <MessageCircle className="size-3.5" aria-hidden />
                WhatsApp
              </a>
            ) : null}
          </p>
        </div>
        <ArchiveButton patientId={patient.id} archived={Boolean(patient.archived_at)} name={patient.full_name} />
      </div>
    </div>
  );
}
