import { Fragment } from "react";
import Link from "next/link";
import { cn } from "cn";

import type { AppointmentStatus } from "@/features/agenda/labels";
import { utcToZoned } from "@/lib/timezone";

import { BlockEmpty } from "./dashboard-card";

type TimelineAppointment = {
  id: string;
  starts_at: string;
  status: AppointmentStatus;
  type: string | null;
  patient_id: string;
  patients: { full_name: string } | null;
  professionals: { name: string } | null;
};

/** Estado escrito por extenso (a cor do ponto nunca é o único sinal). */
const statusText: Record<AppointmentStatus, string> = {
  scheduled: "agendada",
  confirmed: "confirmada",
  arrived: "na sala de espera",
  in_progress: "em atendimento",
  done: "concluída",
  no_show: "faltou",
  canceled: "cancelada",
};

const dotClass: Record<AppointmentStatus, string> = {
  scheduled: "bg-card ring-input border-2 border-muted-foreground/50",
  confirmed: "bg-success ring-success-soft",
  arrived: "bg-warning ring-warning-soft",
  in_progress: "bg-primary ring-accent",
  done: "bg-muted-foreground ring-muted",
  no_show: "bg-destructive ring-destructive-soft",
  canceled: "bg-muted-foreground ring-muted",
};

function NowMarker({ time }: { time: string }) {
  return (
    <li className="flex items-center gap-2 py-0.5">
      <span className="text-[0.6875rem] font-bold text-destructive tabular-nums">
        <span className="sr-only">Agora, </span>
        {time}
      </span>
      <span className="h-0.5 flex-1 rounded-full bg-destructive" aria-hidden />
    </li>
  );
}

/** Consultas de hoje em linha do tempo, com o marcador "agora". */
export function TodayTimeline({ appointments, nowTime, nowMinutes }: { appointments: TimelineAppointment[]; nowTime: string; nowMinutes: number }) {
  if (!appointments.length) return <BlockEmpty>Nenhuma consulta hoje.</BlockEmpty>;

  const nowIndex = appointments.findIndex((a) => utcToZoned(a.starts_at).minutes > nowMinutes);
  const markerAt = nowIndex === -1 ? appointments.length : nowIndex;

  return (
    <ol className="-mt-1 max-h-[26rem] overflow-y-auto pr-1">
      {appointments.map((a, i) => {
        const faded = a.status === "done" || a.status === "no_show";
        return (
          <Fragment key={a.id}>
            {i === markerAt ? <NowMarker time={nowTime} /> : null}
            <li className="grid grid-cols-[2.75rem_0.75rem_minmax(0,1fr)] items-start gap-2.5 py-1.5">
              <span className={cn("pt-px text-[0.8125rem] font-semibold tabular-nums", faded && "font-medium text-muted-foreground")}>{utcToZoned(a.starts_at).time}</span>
              <span className={cn("mt-1 size-2.5 rounded-full ring-3", dotClass[a.status])} aria-hidden />
              <span className="flex min-w-0 flex-col">
                <Link href={`/pacientes/${a.patient_id}`} className={cn("truncate text-sm font-medium hover:underline", faded && "text-muted-foreground", a.status === "no_show" && "line-through")}>
                  {a.patients?.full_name}
                </Link>
                <span className="truncate text-xs text-muted-foreground">{[a.type, a.professionals?.name, statusText[a.status]].filter(Boolean).join(" · ")}</span>
              </span>
            </li>
          </Fragment>
        );
      })}
      {markerAt === appointments.length ? <NowMarker time={nowTime} /> : null}
    </ol>
  );
}
