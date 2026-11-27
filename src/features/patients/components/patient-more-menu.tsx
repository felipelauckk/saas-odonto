"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, CalendarCheck, Ellipsis, FileDown, Gift, Printer, Star, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PortalLinkDialog } from "@/features/booking/components/portal-link-dialog";

import { ArchiveDialog } from "./archive-button";
import { ShareLinkDialog } from "./share-link-dialog";

type Props = {
  patient: { id: string; name: string; phone: string | null; archived: boolean };
  canExport: boolean;
  canPortal: boolean;
  bookingUrl: string | null;
  referralUrl: string | null;
  reviewUrl?: string | null;
};

type Open = "archive" | "portal" | "booking" | "referral" | "review" | null;

/** Menu "Mais" da ficha: ações menos usadas. */
export function PatientMoreMenu({ patient, canExport, canPortal, bookingUrl, referralUrl, reviewUrl = null }: Props) {
  const [open, setOpen] = useState<Open>(null);
  const close = (o: boolean) => {
    if (!o) setOpen(null);
  };
  const firstName = patient.name.split(" ")[0];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" />}>
          <Ellipsis aria-hidden />
          Mais
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuItem render={<a href={`/pacientes/${patient.id}/imprimir`} target="_blank" rel="noreferrer" />}>
            <Printer aria-hidden />
            Imprimir dados
          </DropdownMenuItem>
          {canExport ? (
            <DropdownMenuItem render={<a href={`/pacientes/${patient.id}/exportar`} />}>
              <FileDown aria-hidden />
              Exportar dados (LGPD)
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          {canPortal && !patient.archived ? (
            <DropdownMenuItem onClick={() => setOpen("portal")}>
              <UserRound aria-hidden />
              Link do portal
            </DropdownMenuItem>
          ) : null}
          {bookingUrl ? (
            <DropdownMenuItem onClick={() => setOpen("booking")}>
              <CalendarCheck aria-hidden />
              Link de agendamento online
            </DropdownMenuItem>
          ) : null}
          {referralUrl ? (
            <DropdownMenuItem onClick={() => setOpen("referral")}>
              <Gift aria-hidden />
              Link de indicação
            </DropdownMenuItem>
          ) : null}
          {reviewUrl ? (
            <DropdownMenuItem onClick={() => setOpen("review")}>
              <Star aria-hidden />
              Pedir avaliação no Google
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setOpen("archive")}>
            {patient.archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
            {patient.archived ? "Reativar" : "Inativar"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ArchiveDialog patientId={patient.id} archived={patient.archived} name={patient.name} open={open === "archive"} onOpenChange={close} />
      {open === "portal" ? <PortalLinkDialog patientId={patient.id} open onOpenChange={close} /> : null}
      {bookingUrl ? (
        <ShareLinkDialog
          title="Link de agendamento online"
          description="O paciente escolhe o horário livre e marca sozinho."
          url={bookingUrl}
          message={`Olá, ${firstName}! Para marcar sua consulta é só escolher o horário aqui:`}
          phone={patient.phone}
          open={open === "booking"}
          onOpenChange={close}
        />
      ) : null}
      {reviewUrl ? (
        <ShareLinkDialog
          title="Pedir avaliação no Google"
          description="Manda o link de avaliação da clínica pelo WhatsApp do paciente."
          url={reviewUrl}
          message={`Olá, ${firstName}! Obrigado por vir à clínica. Se puder, conte como foi o atendimento no Google:`}
          phone={patient.phone}
          open={open === "review"}
          onOpenChange={close}
        />
      ) : null}
      {referralUrl ? (
        <ShareLinkDialog
          title="Link de indicação"
          description={`Quem preencher entra no CRM como lead indicado por ${patient.name}.`}
          url={referralUrl}
          message={`Olá, ${firstName}! Se quiser indicar a clínica para alguém, é só mandar este link:`}
          phone={patient.phone}
          open={open === "referral"}
          onOpenChange={close}
        />
      ) : null}
    </>
  );
}
