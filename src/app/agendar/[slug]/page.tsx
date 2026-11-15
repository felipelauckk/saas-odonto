import type { Metadata } from "next";
import { CalendarX } from "lucide-react";

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
    <div className="min-h-full bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-xl space-y-6">
        {page ? (
          <>
            <div className="space-y-1">
              <h1 className="text-xl font-semibold tracking-tight">{page.clinicName}</h1>
              <p className="text-sm text-muted-foreground">{page.intro || "Escolha o melhor horário para a sua consulta."}</p>
            </div>
            <BookingWizard page={page} today={utcToZoned(new Date()).date} actions={{ getSlots, startBooking, finishBooking }} />
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-xl border p-8 text-center">
            <CalendarX className="size-8 text-muted-foreground" aria-hidden />
            <h1 className="text-lg font-medium">Agendamento online indisponível</h1>
            <p className="text-sm text-muted-foreground">Entre em contato com a clínica.</p>
          </div>
        )}
      </div>
    </div>
  );
}
