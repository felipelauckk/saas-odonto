import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { AppointmentStatusBadge } from "@/features/agenda/components/status-badge";
import { listPatientAppointments } from "@/features/agenda/queries";
import { formatLongDate, utcToZoned } from "@/lib/timezone";

export const metadata: Metadata = { title: "Agendamentos" };

export default async function Page({ params }: PageProps<"/pacientes/[id]/agendamentos">) {
  const { id } = await params;
  const appointments = await listPatientAppointments(id);
  const now = new Date().toISOString();
  const upcoming = appointments.filter((a) => a.starts_at >= now).reverse();
  const past = appointments.filter((a) => a.starts_at < now);

  const goToAgenda = (
    <Link href="/agenda" className={buttonVariants({ variant: "outline" })}>
      <Plus aria-hidden />
      Marcar na agenda
    </Link>
  );

  if (!appointments.length) {
    return <EmptyState icon={CalendarDays} title="Nenhuma consulta" description="As consultas deste paciente aparecem aqui." action={goToAgenda} />;
  }

  const list = (items: typeof appointments) => (
    <ul className="divide-y rounded-xl border">
      {items.map((a) => {
        const start = utcToZoned(a.starts_at);
        const end = utcToZoned(a.ends_at);
        return (
          <li key={a.id} className="flex items-center gap-4 px-4 py-3 sm:px-5">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: a.professionals?.color ?? "#64748b" }} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium first-letter:uppercase">
                {formatLongDate(start.date)} · {start.time}–{end.time}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {[a.professionals?.name, a.type, a.units?.name].filter(Boolean).join(" · ")}
              </p>
            </div>
            <AppointmentStatusBadge status={a.status} />
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-end">{goToAgenda}</div>
      {upcoming.length ? (
        <section className="space-y-2" aria-labelledby="proximas">
          <h2 id="proximas" className="text-sm font-medium text-muted-foreground">
            Próximas
          </h2>
          {list(upcoming)}
        </section>
      ) : null}
      {past.length ? (
        <section className="space-y-2" aria-labelledby="anteriores">
          <h2 id="anteriores" className="text-sm font-medium text-muted-foreground">
            Anteriores
          </h2>
          {list(past)}
        </section>
      ) : null}
    </div>
  );
}
