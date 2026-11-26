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

import { createReturn, fillFromWaitlist, findWaitlistMatches, setAppointmentStatus } from "../actions";
import { cancelReasonLabels, type CancelReason } from "../advanced";
import { Input } from "@/components/ui/input";
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
  procedures?: { id: string; return_months: number | null }[];
  unitId?: string;
};

export function AppointmentDetails({ appointment: a, professionalName, chairName, onEdit, onDone, canSendReminder = false, procedures = [] }: Props) {
  const [status, setStatus] = useState(a.status);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [asking, setAsking] = useState<"cancel" | "return" | null>(null);
  const [reason, setReason] = useState<CancelReason>("patient_canceled");
  const [note, setNote] = useState("");
  // Retorno sugerido pelo primeiro procedimento da consulta.
  const firstProcedureId = a.procedures[0]?.procedureId ?? null;
  const defaultMonths = procedures.find((p) => p.id === firstProcedureId)?.return_months ?? 6;
  const [months, setMonths] = useState(String(defaultMonths));
  const [matches, setMatches] = useState<{ id: string; patientName: string; notes: string | null }[] | null>(null);
  const start = utcToZoned(a.startsAt);
  const end = utcToZoned(a.endsAt);

  function changeStatus(next: AppointmentStatus, extra?: { cancelReason?: CancelReason; cancelNote?: string }) {
    if (next === status) return;
    if (next === "canceled" && !extra) {
      setAsking("cancel");
      return;
    }
    const previous = status;
    setStatus(next);
    setError(null);
    startTransition(async () => {
      const result = await setAppointmentStatus({ id: a.id, status: next, ...extra });
      if (result.error) {
        setStatus(previous);
        setError(result.error);
      } else if (next === "canceled") {
        setAsking(null);
        setMatches(await findWaitlistMatches(a.id));
      } else if (next === "done") {
        setAsking("return");
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
        {a.procedures.length ? (
          <ul className="space-y-0.5 pt-1 text-sm" aria-label="Procedimentos">
            {a.procedures.map((p, i) => (
              <li key={`${p.procedureId}-${i}`}>
                {p.name}
                {p.tooth ? <span className="text-muted-foreground"> · dente {p.tooth}{p.faces?.length ? ` (${p.faces.join("")})` : ""}</span> : null}
              </li>
            ))}
          </ul>
        ) : null}
        {a.notes ? <p className="whitespace-pre-line pt-1 text-sm">{a.notes}</p> : null}
        {a.bookedOnline || a.rescheduleRequestedAt ? (
          <p className="flex flex-wrap gap-2 pt-1 text-xs">
            {a.bookedOnline ? <span className="rounded-full border px-2 py-0.5">Agendada online</span> : null}
            {a.rescheduleRequestedAt ? <span className="rounded-full border border-amber-400 px-2 py-0.5 text-amber-800 dark:text-amber-300">O paciente pediu remarcação pelo portal</span> : null}
          </p>
        ) : null}
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

      {asking === "cancel" ? (
        <div className="space-y-3 rounded-lg border p-3">
          <p className="text-sm font-medium">Motivo da desmarcação</p>
          <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label="Motivo">
            {(Object.keys(cancelReasonLabels) as CancelReason[]).map((r) => (
              <button key={r} type="button" aria-pressed={reason === r} onClick={() => setReason(r)}
                className={cn("h-9 rounded-lg border px-2 text-sm pointer-coarse:h-11", reason === r ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>
                {cancelReasonLabels[r]}
              </button>
            ))}
          </div>
          <Input aria-label="Observação da desmarcação" placeholder="Observação (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" disabled={pending} onClick={() => changeStatus("canceled", { cancelReason: reason, cancelNote: note })}>Desmarcar consulta</Button>
            <Button size="sm" variant="ghost" onClick={() => setAsking(null)}>Voltar</Button>
          </div>
        </div>
      ) : null}

      {matches ? (
        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-sm font-medium">{matches.length ? "Da lista de espera, cabem neste horário:" : "Ninguém da lista de espera cabe neste horário."}</p>
          {matches.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-2 text-sm">
              <span>{m.patientName}{m.notes ? <span className="text-muted-foreground"> · {m.notes}</span> : null}</span>
              <Button size="sm" disabled={pending} onClick={() => startTransition(async () => {
                const r = await fillFromWaitlist(m.id, a.id);
                if (r.error) setError(r.error); else onDone();
              })}>Encaixar</Button>
            </div>
          ))}
          <Button size="sm" variant="ghost" onClick={onDone}>Fechar</Button>
        </div>
      ) : null}

      {asking === "return" ? (
        <div className="space-y-3 rounded-lg border p-3">
          <p className="text-sm font-medium">Definir alerta de retorno?</p>
          <div className="flex items-end gap-2">
            <div className="space-y-1.5">
              <label htmlFor="return-months" className="text-sm">Retorno em (meses)</label>
              <Input id="return-months" inputMode="numeric" className="w-24" value={months} onChange={(e) => setMonths(e.target.value)} />
            </div>
            <Button size="sm" disabled={pending} onClick={() => startTransition(async () => {
              const n = Number(months);
              if (!Number.isInteger(n) || n < 1 || n > 60) return setError("Meses entre 1 e 60.");
              const r = await createReturn({ patientId: a.patientId, months: n, reason: a.type || "Retorno", professionalId: a.professionalId, procedureId: firstProcedureId, sourceAppointmentId: a.id });
              if (r.error) setError(r.error); else setAsking(null);
            })}>Agendar alerta</Button>
            <Button size="sm" variant="ghost" onClick={() => setAsking(null)}>Sem retorno</Button>
          </div>
        </div>
      ) : null}

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
