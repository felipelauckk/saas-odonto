import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, MapPin } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { AgendaView } from "@/features/agenda/components/agenda-view";
import { FreedSlot } from "@/features/agenda/components/freed-slot";
import { MiniCalendar } from "@/features/agenda/components/mini-calendar";
import { WaitingRoom } from "@/features/agenda/components/waiting-room";
import { getAgendaData, getFreedSlot, getMonthOccupancy, getWaitingRoom } from "@/features/agenda/queries";
import { agendaParamsSchema } from "@/features/agenda/schemas";
import { requireClinic } from "@/features/tenancy/guards";
import { formatPhone } from "@/lib/documents";
import { createClient } from "@/lib/supabase/server";
import { todayIso } from "@/lib/dates";
import { startOfWeek } from "@/lib/timezone";
import { optional } from "@/lib/optional";

export const metadata: Metadata = { title: "Agenda" };

const shortDay = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });

function AsideError({ what }: { what: string }) {
  return (
    <p role="alert" className="rounded-card border bg-card p-4 text-sm text-destructive">
      Não foi possível carregar {what}. Recarregue a página para tentar de novo.
    </p>
  );
}

const MORE_LINKS = [
  { href: "/agenda/sala-de-espera", label: "Sala de espera" },
  { href: "/agenda/espera", label: "Lista de espera" },
  { href: "/agenda/retornos", label: "Retornos" },
  { href: "/agenda/faltas", label: "Faltas e desmarcações" },
];

export default async function Page({ searchParams }: PageProps<"/agenda">) {
  const session = await requireClinic();
  const params = agendaParamsSchema.parse(await searchParams);
  const today = todayIso();
  const date = params.data ?? today;
  const unit = session.activeUnit;

  if (!unit) {
    return (
      <div className="space-y-8">
        <PageHeader title="Agenda" />
        <EmptyState icon={MapPin} title="Nenhuma unidade disponível" description="Você não tem acesso a nenhuma unidade ativa desta clínica." />
      </div>
    );
  }

  const isDentist = session.clinic.role === "dentist";
  const view = params.visao;
  const data = await getAgendaData({
    unitId: unit.id,
    from: view === "semana" ? startOfWeek(date) : date,
    days: view === "semana" ? 7 : 1,
    isDentist,
  });

  let presetPatient = null;
  if (params.paciente) {
    const supabase = await createClient();
    const { data: p } = await supabase.from("patients").select("id, full_name, phone, whatsapp").eq("id", params.paciente).is("archived_at", null).maybeSingle();
    const phone = p?.whatsapp ?? p?.phone;
    if (p) presetPatient = { id: p.id, name: p.full_name, detail: phone ? formatPhone(phone) : null };
  }

  const [levels, waiting, freed] = await Promise.all([
    optional("agenda", getMonthOccupancy(unit.id, date.slice(0, 7), data.professionals.map((p) => p.id))),
    optional("agenda", getWaitingRoom(unit.id, today)),
    optional("agenda", getFreedSlot(unit.id)),
  ]);

  const hrefFor = (day: string) => {
    const qs = new URLSearchParams();
    if (day !== today) qs.set("data", day);
    if (view !== "dia") qs.set("visao", view);
    if (params.por !== "profissional") qs.set("por", params.por);
    if (params.id && view === "semana") qs.set("id", params.id);
    const q = qs.toString();
    return q ? `/agenda?${q}` : "/agenda";
  };

  const aside = (
    <>
      {levels.ok ? <MiniCalendar date={date} today={today} levels={levels.value} hrefFor={hrefFor} /> : <AsideError what="o calendário" />}
      <section aria-labelledby="sala" className="space-y-1 rounded-card border bg-card p-4">
        <div className="flex items-baseline justify-between gap-2 pb-1">
          <h2 id="sala" className="type-section">
            Sala de espera
          </h2>
          {waiting.ok ? (
            <span className="text-xs text-muted-foreground">
              {waiting.value.length} {waiting.value.length === 1 ? "paciente" : "pacientes"}
            </span>
          ) : null}
        </div>
        {waiting.ok ? <WaitingRoom rows={waiting.value} unitId={unit.id} compact /> : <p className="text-sm text-destructive">Não foi possível carregar a sala de espera.</p>}
      </section>
      {freed.ok ? (
        freed.value ? (
          <FreedSlot
            slot={freed.value.slot}
            professionalName={freed.value.professionalName}
            matches={freed.value.matches}
            dayLabel={shortDay.format(new Date(`${freed.value.slot.date}T00:00:00Z`)).replace("-feira", "").replace(".", "")}
          />
        ) : null
      ) : (
        <AsideError what="as vagas liberadas" />
      )}
      <nav aria-label="Mais da agenda" className="rounded-card border bg-card p-2">
        <ul>
          {MORE_LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="flex min-h-10 items-center justify-between rounded-md px-2 text-sm hover:bg-muted pointer-coarse:min-h-11">
                {l.label}
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );

  return (
    <div className="space-y-5">
      <AgendaView
        data={data}
        unitId={unit.id}
        date={date}
        today={today}
        view={view}
        by={params.por}
        selectedId={params.id ?? null}
        isDentist={isDentist}
        presetPatient={presetPatient}
        subtitle={session.units.length > 1 ? unit.name : isDentist ? "Sua agenda" : undefined}
        aside={aside}
      />
    </div>
  );
}
