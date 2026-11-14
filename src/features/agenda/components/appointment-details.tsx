"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { BellRing, MessageCircle, Pencil } from "lucide-react";
import { cn } from "cn";

import { FormMessage } from "@/components/forms/form-message";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatPhone } from "@/lib/documents";
import { formatLongDate, minutesToTime, utcToZoned } from "@/lib/timezone";

import { sendReminderNow } from "@/features/messaging/actions";

import { setAppointmentStatus } from "../actions";
import { statusLabels, type AppointmentStatus } from "../labels";
import type { AgendaAppointment } from "../queries";

/** Ordem dos botões de status (um clique muda). */
const STATUS_ACTIONS: AppointmentStatus[] = ["scheduled", "confirmed", "arrived", "in_progress", "done", "no_show", "canceled"];

type Props = {
  appointment: AgendaAppointment;
  professionalName: string;
  chairName: string | null;
  onEdit: () => void;
  onDone: () => void;
  canSendReminder?: boolean;
};

export function AppointmentDetails({ appointment: a, professionalName, chairName, onEdit, onDone, canSendReminder = false }: Props) {
  const [status, setStatus] = useState(a.status);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const start = utcToZoned(a.startsAt);
  const end = utcToZoned(a.endsAt);

  function changeStatus(next: AppointmentStatus) {
    if (next === status) return;
    const previous = status;
    setStatus(next);
    setError(null);
    startTransition(async () => {
      const result = await setAppointmentStatus({ id: a.id, status: next });
      if (result.error) {
        setStatus(previous);
        setError(result.error);
      } else if (next === "canceled") {
        onDone();
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <Link href={`/pacientes/${a.patientId}`} className="text-lg font-semibold tracking-tight hover:underline">
          {a.patientName}
        </Link>
        <p className="text-sm text-muted-foreground">
          {formatLongDate(start.date)} · {start.time} às {end.date === start.date ? end.time : minutesToTime(a.endMin)}
        </p>
        <p className="text-sm text-muted-foreground">
          {[professionalName, chairName, a.type].filter(Boolean).join(" · ")}
        </p>
        {a.notes ? <p className="whitespace-pre-line pt-1 text-sm">{a.notes}</p> : null}
      </div>

      {error ? <FormMessage state={{ status: "error", message: error }} /> : null}
      {notice ? <FormMessage state={{ status: "success", message: notice }} /> : null}

      <div className="space-y-2">
        <p className="text-sm font-medium" id="status-label">
          Status
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-labelledby="status-label">
          {STATUS_ACTIONS.map((s) => (
            <button
              key={s}
              type="button"
              disabled={pending}
              aria-pressed={status === s}
              onClick={() => changeStatus(s)}
              className={cn(
                "h-9 rounded-lg border px-2 text-sm font-medium transition-colors disabled:opacity-60 pointer-coarse:h-11",
                status === s
                  ? s === "no_show" || s === "canceled"
                    ? "border-destructive bg-destructive/10 text-destructive"
                    : "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-muted",
              )}
            >
              {statusLabels[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" variant="outline" onClick={onEdit}>
          <Pencil aria-hidden />
          Editar ou remarcar
        </Button>
        {canSendReminder && (status === "scheduled" || status === "confirmed") ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await sendReminderNow(a.id);
                if (result.error) setError(result.error);
                else setNotice(result.message ?? "Lembrete enviado.");
              })
            }
          >
            <BellRing aria-hidden />
            Enviar lembrete
          </Button>
        ) : null}
        {a.patientPhone ? (
          <a
            href={`https://wa.me/55${a.patientPhone}`}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: "outline" })}
          >
            <MessageCircle aria-hidden />
            WhatsApp {formatPhone(a.patientPhone)}
          </a>
        ) : null}
      </div>
    </div>
  );
}
