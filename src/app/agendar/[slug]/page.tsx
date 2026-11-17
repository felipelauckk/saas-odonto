import type { Metadata } from "next";
import { CalendarX } from "lucide-react";

import { PublicNotice, PublicShell } from "@/components/app/public-shell";

import { BookingWizard } from "@/features/booking/components/booking-wizard";
import { loadBookingPage } from "@/features/booking/service";
import { utcToZoned } from "@/lib/timezone";

import { finishBooking, getSlots, startBooking } from "./actions";

export async function generateMetadata({ params }: PageProps<"/agendar/[slug]">): Promise<Metadata> {
  const page = await loadBookingPage((await params).slug);
  return { title: page ? `Agendar · ${page.clinicName}` : "Agendamento online" };
}

export default async function Page({ params }: PageProps<"/agendar/[slug]">) {
  const page = await loadBookingPage((await params).slug);
  return (
    <PublicShell
      clinicName={page?.clinicName ?? null}
      detail={page && page.units.length === 1 ? page.units[0]!.name : null}
      footer="Agendamento por Arcada · seus dados ficam protegidos (LGPD)."
    >
      {page ? (
        <>
          <div className="space-y-1">
            <h1 className="type-title">Agende sua consulta</h1>
            <p className="text-sm text-muted-foreground">{page.intro || "Escolha o melhor horário para a sua consulta."}</p>
          </div>
          <BookingWizard page={page} today={utcToZoned(new Date()).date} actions={{ getSlots, startBooking, finishBooking }} />
        </>
      ) : (
        <PublicNotice icon={<CalendarX aria-hidden />} title="Agendamento online indisponível">
          Entre em contato com a clínica.
        </PublicNotice>
      )}
    </PublicShell>
  );
}
