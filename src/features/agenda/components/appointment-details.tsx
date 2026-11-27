"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { BellRing, CalendarClock, Check, CircleAlert, FileText, MessageCircle, MoreHorizontal, Pencil, Plus, Printer, ReceiptText, Trash2, Wallet, X } from "lucide-react";
import { cn } from "cn";

import { FormMessage } from "@/components/forms/form-message";
import { Button, buttonVariants } from "@/components/ui/button";
import { DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ageFromBirthDate } from "@/lib/dates";
import { formatPhone } from "@/lib/documents";
import { formatCurrency } from "@/lib/format";
import { minutesToTime, utcToZoned } from "@/lib/timezone";
import { ReceiveForm } from "@/features/finance/components/receivables-list";
import { sendReminderNow } from "@/features/messaging/actions";

import {
  addToWaitlist,
  createReturn,
  deleteAppointment,
  fillFromWaitlist,
  findWaitlistMatches,
  loadAppointmentCard,
  setAppointmentStatus,
  toggleAppointmentTag,
  type AppointmentCardData,
} from "../actions";
import { cancelReasonLabels, isLate, type CancelReason } from "../advanced";
import { statusLabels, type AppointmentStatus } from "../labels";
import { initials } from "../overview";
import type { AgendaAppointment } from "../queries";

import { shortDate } from "./entry-parts";

/** Ordem do seletor de status (mesma da legenda). */
const STATUS_ORDER: AppointmentStatus[] = ["scheduled", "confirmed", "arrived", "in_progress", "done", "no_show", "canceled"];

/** Ponto de cor de cada status (o nome sempre vem escrito ao lado). */
const STATUS_DOT: Record<AppointmentStatus, string> = {
  scheduled: "bg-muted-foreground",
  confirmed: "bg-success",
  arrived: "bg-warning",
  in_progress: "bg-primary",
  done: "bg-accent-foreground",
  no_show: "bg-destructive",
  canceled: "bg-muted-foreground/50",
};

const AVATAR_TINTS = ["bg-tint-sky text-tint-sky-foreground", "bg-tint-mint text-tint-mint-foreground", "bg-tint-lilac text-tint-lilac-foreground", "bg-tint-peach text-tint-peach-foreground", "bg-tint-rose text-tint-rose-foreground"];
const tintOf = (id: string) => AVATAR_TINTS[[...id].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_TINTS.length]!;

const monthShort = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "short" });
const dateTime = (iso: string) => {
  const z = utcToZoned(iso);
  return `${z.date.slice(8, 10)}/${z.date.slice(5, 7)} às ${z.time}`;
};
const dayMonth = (iso: string) => {
  const z = utcToZoned(iso);
  return `${z.date.slice(8, 10)}/${z.date.slice(5, 7)}`;
};


type Props = {
  appointment: AgendaAppointment;
  professionalName: string;
  professionalColor: string;
  chairName: string | null;
  tags: { id: string; name: string; color: string }[];
  isDentist: boolean;
  /** Editar (ou remarcar: abre já na grade de horários). */
  onEdit: (focus?: "slots") => void;
  onDone: (message?: string) => void;
  canSendReminder?: boolean;
  procedures?: { id: string; return_months: number | null }[];
};

function Shortcut({ href, label, icon: Icon, tint, external }: { href: string; label: string; icon: typeof FileText; tint: string; external?: boolean }) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="flex h-16 flex-col items-center justify-center gap-1.5 rounded-xl border bg-card text-[0.6875rem] font-semibold transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
    >
      <span className={cn("flex size-7 items-center justify-center rounded-lg", tint)}>
        <Icon className="size-4" aria-hidden />
      </span>
      {label}
    </a>
  );
}

/** Cartão da consulta (P3): quem é, alerta, o que vai fazer, se está em dia e o status num clique. */
export function AppointmentDetails({ appointment: a, professionalName, professionalColor, chairName, tags, isDentist, onEdit, onDone, canSendReminder = false, procedures = [] }: Props) {
  const [status, setStatus] = useState(a.status);
  const [tagIds, setTagIds] = useState(a.tagIds);
  const [card, setCard] = useState<AppointmentCardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [asking, setAsking] = useState<"cancel" | "return" | "receive" | "delete" | null>(null);
  const [reason, setReason] = useState<CancelReason>("patient_canceled");
  const [note, setNote] = useState("");
  const firstProcedureId = a.procedures.find((p) => p.procedureId)?.procedureId ?? null;
  const defaultMonths = procedures.find((p) => p.id === firstProcedureId)?.return_months ?? 6;
  const [months, setMonths] = useState(String(defaultMonths));
  const [matches, setMatches] = useState<{ id: string; patientName: string; notes: string | null }[] | null>(null);
  const [addingTag, setAddingTag] = useState(false);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    loadAppointmentCard(a.id).then((d) => alive && setCard(d));
    const t = setTimeout(() => setNow(Date.now()), 0);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [a.id]);

  const reload = () => loadAppointmentCard(a.id).then(setCard);
  const start = utcToZoned(a.startsAt);
  const end = utcToZoned(a.endsAt);
  const durationMin = Math.round((Date.parse(a.endsAt) - Date.parse(a.startsAt)) / 60_000);
  const phone = card?.patient.whatsapp ?? card?.patient.phone ?? a.patientPhone;
  const age = card?.patient.birthDate ? ageFromBirthDate(card.patient.birthDate) : null;
  const late = now !== null && isLate({ status, startsAt: a.startsAt, arrivedAt: card?.arrivedAt ?? null }, now);
  const firstName = a.patientName.split(" ")[0];
  const confirmText = `Olá, ${firstName}! Confirmando sua consulta ${shortDate(start.date).toLowerCase()} às ${start.time} com ${professionalName}. Podemos confirmar?`;
  const whatsappHref = phone ? `https://wa.me/55${phone}${status === "scheduled" ? `?text=${encodeURIComponent(confirmText)}` : ""}` : null;

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
      if (!result.error) void reload();
    });
  }

  function toggleTag(tagId: string, on: boolean) {
    setTagIds((ids) => (on ? [...ids, tagId] : ids.filter((x) => x !== tagId)));
    setAddingTag(false);
    startTransition(async () => {
      const r = await toggleAppointmentTag(a.id, tagId, on);
      if (r.error) {
        setError(r.error);
        setTagIds((ids) => (on ? ids.filter((x) => x !== tagId) : [...ids, tagId]));
      }
    });
  }

  // Linhas do rodapé ----------------------------------------------------------------------
  const byLine = a.bookedOnline
    ? `Agendado online pelo paciente em ${card ? dayMonth(card.createdAt) : "…"}`
    : card
      ? `Agendado${card.createdByName ? ` por ${card.createdByName.split(" ")[0]}` : ""} em ${dateTime(card.createdAt)}`
      : "…";
  const situation =
    status === "arrived" && card?.arrivedAt
      ? `Chegou às ${utcToZoned(card.arrivedAt).time} · na sala de espera`
      : status === "in_progress"
        ? "Em atendimento agora"
        : status === "done"
          ? "Atendimento concluído"
          : status === "no_show"
            ? "O paciente faltou"
            : status === "canceled"
              ? "Consulta desmarcada"
              : status === "confirmed" && card?.confirmedAt
                ? `Confirmado${card.confirmedByWhatsApp ? " pelo WhatsApp" : ""} em ${dayMonth(card.confirmedAt)}`
                : "Aguardando confirmação";

  const fin = card?.finance?.status ?? null;
  const tagById = new Map(tags.map((t) => [t.id, t]));
  const freeTags = tags.filter((t) => !tagIds.includes(t.id));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
        {/* Cabeçalho */}
        <div className="flex items-start gap-3.5 px-5 pt-5 pr-14">
          <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-[22%] text-base font-extrabold", tintOf(a.patientId))} aria-hidden>
            {initials(a.patientName)}
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <DialogTitle className="text-lg leading-tight font-extrabold tracking-tight">
              <Link href={`/pacientes/${a.patientId}`} className="hover:underline">
                {a.patientName}
              </Link>
            </DialogTitle>
            <p className="text-[0.8125rem] text-muted-foreground tabular-nums">{[age !== null ? `${age} anos` : null, phone ? formatPhone(phone) : null].filter(Boolean).join(" · ") || " "}</p>
            <ul className="flex flex-wrap gap-1.5 pt-1 text-[0.6875rem] font-bold" aria-label="Etiquetas do paciente">
              {card?.alerts.map((al, i) => (
                <li key={i} className="rounded-full bg-destructive-soft px-2.5 py-0.5 text-destructive">
                  {al.details ? `${al.label.replace(/\?\s*$/, "")}: ${al.details}` : al.label.replace(/\?\s*$/, "")}
                </li>
              ))}
              {a.isFirstVisit ? <li className="rounded-full bg-tint-sky px-2.5 py-0.5 text-tint-sky-foreground">Primeira vez</li> : null}
              {card?.patient.referredBy ? <li className="rounded-full bg-tint-mint px-2.5 py-0.5 text-tint-mint-foreground">Indicado por {card.patient.referredBy}</li> : null}
              {card?.returnOverdue ? <li className="rounded-full bg-tint-peach px-2.5 py-0.5 text-tint-peach-foreground">Retorno vencido</li> : null}
              {late ? <li className="rounded-full bg-tint-peach px-2.5 py-0.5 text-tint-peach-foreground">Atrasado</li> : null}
              {a.rescheduleRequestedAt ? <li className="rounded-full bg-warning-soft px-2.5 py-0.5 text-warning">Pediu remarcação pelo portal</li> : null}
            </ul>
          </div>
        </div>

        {/* Atalhos */}
        <nav aria-label="Atalhos do paciente" className={cn("grid gap-2 px-5", isDentist || !whatsappHref ? "grid-cols-3" : "grid-cols-4")}>
          <Shortcut href={`/pacientes/${a.patientId}`} label="Ficha" icon={FileText} tint="bg-accent text-accent-foreground" />
          {whatsappHref ? <Shortcut href={whatsappHref} label="WhatsApp" icon={MessageCircle} tint="bg-tint-mint text-tint-mint-foreground" external /> : null}
          <Shortcut href={`/pacientes/${a.patientId}/orcamentos`} label="Orçamentos" icon={ReceiptText} tint="bg-tint-lilac text-tint-lilac-foreground" />
          {isDentist ? null : <Shortcut href={`/pacientes/${a.patientId}/financeiro`} label="Financeiro" icon={Wallet} tint="bg-tint-peach text-tint-peach-foreground" />}
        </nav>

        {/* Data, profissional e procedimentos */}
        <div className="mx-5 space-y-3 rounded-2xl bg-muted/70 p-3.5">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-xl border bg-card" aria-hidden>
              <span className="text-[0.5625rem] font-extrabold text-primary uppercase">{monthShort.format(new Date(`${start.date}T00:00:00Z`)).replace(".", "")}</span>
              <span className="text-[0.9375rem] leading-none font-extrabold">{Number(start.date.slice(8, 10))}</span>
            </span>
            <span className="min-w-0 flex-1 space-y-0.5">
              <span className="block text-sm font-bold tabular-nums">
                {shortDate(start.date)} · {start.time} – {end.date === start.date ? end.time : minutesToTime(a.endMin)} <span className="font-medium text-muted-foreground">({durationMin} min)</span>
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-2 rounded-full" style={{ backgroundColor: professionalColor }} aria-hidden />
                {[professionalName, chairName].filter(Boolean).join(" · ")}
              </span>
            </span>
            <Button type="button" variant="outline" size="icon" aria-label="Remarcar" onClick={() => onEdit("slots")}>
              <CalendarClock />
            </Button>
            <Button type="button" variant="outline" size="icon" aria-label="Editar consulta" onClick={() => onEdit()}>
              <Pencil />
            </Button>
          </div>
          {a.procedures.length || a.type || a.notes ? (
            <div className="space-y-1 border-t pt-3">
              {a.procedures.length ? (
                <>
                  <p className="text-[0.6875rem] font-bold tracking-wider text-muted-foreground uppercase">Procedimentos</p>
                  <ul className="space-y-0.5 text-[0.8125rem]" aria-label="Procedimentos">
                    {a.procedures.map((p, i) => (
                      <li key={`${p.procedureId}-${i}`}>
                        {p.name}
                        {p.tooth ? <span className="text-muted-foreground"> · dente {p.tooth}{p.faces?.length ? ` (${p.faces.join("")})` : ""}</span> : null}
                      </li>
                    ))}
                  </ul>
                </>
              ) : a.type ? (
                <p className="text-[0.8125rem] font-medium">{a.type}</p>
              ) : null}
              {a.notes ? <p className="text-[0.8125rem] whitespace-pre-line text-muted-foreground">{a.notes}</p> : null}
            </div>
          ) : null}
        </div>

        {/* Financeiro (só quem opera o financeiro) */}
        {isDentist ? null : !card ? (
          <p className="mx-5 rounded-xl bg-muted/50 px-3.5 py-3 text-[0.8125rem] text-muted-foreground">Carregando o financeiro…</p>
        ) : fin ? (
          <div className={cn("mx-5 flex items-center justify-between gap-3 rounded-xl px-3.5 py-3", fin.kind === "overdue" ? "bg-destructive-soft" : "bg-success-soft")}>
            <span className="flex items-center gap-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-card">
                {fin.kind === "overdue" ? <CircleAlert className="size-4 text-destructive" aria-hidden /> : <Check className="size-4 text-success" aria-hidden />}
              </span>
              <span className="space-y-0.5">
                <span className={cn("block text-[0.8125rem] font-bold", fin.kind === "overdue" ? "text-destructive" : "text-success")}>
                  {fin.kind === "overdue" ? `Pagamento pendente · ${formatCurrency(fin.overdueCents)} vencido` : "Financeiro em dia"}
                </span>
                <span className="block text-xs text-muted-foreground">{fin.note}</span>
                {card?.finance?.creditCents ? <span className="block text-xs font-semibold text-success">Crédito: {formatCurrency(card.finance.creditCents)}</span> : null}
              </span>
            </span>
            {fin.kind === "overdue" ? (
              <Button type="button" size="sm" onClick={() => setAsking("receive")}>
                Receber
              </Button>
            ) : null}
          </div>
        ) : null}

        {asking === "receive" && fin?.kind === "overdue" && card?.finance ? (
          <div className="mx-5 space-y-2 rounded-xl border p-3.5">
            <p className="text-sm font-semibold">
              Receber: {fin.oldest.description} · venc. {fin.oldest.due_date.split("-").reverse().join("/")}
            </p>
            <ReceiveForm
              receivable={fin.oldest}
              patientId={a.patientId}
              paymentMethods={card.finance.paymentMethods}
              onDone={() => {
                setAsking(null);
                setNotice("Recebimento registrado.");
                void reload();
              }}
            />
          </div>
        ) : null}

        {/* Marcadores */}
        <div className="flex flex-wrap items-center gap-1.5 px-5">
          <span className="mr-1 text-[0.6875rem] font-bold tracking-wider text-muted-foreground uppercase" id="card-tags">
            Marcadores
          </span>
          <ul className="contents" aria-labelledby="card-tags">
            {tagIds.map((id) => {
              const t = tagById.get(id);
              if (!t) return null;
              return (
                <li key={id} className="inline-flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2.5 text-xs font-semibold" style={{ backgroundColor: `color-mix(in oklab, ${t.color} 16%, transparent)` }}>
                  <span className="size-2 rounded-full" style={{ backgroundColor: t.color }} aria-hidden />
                  {t.name}
                  <button type="button" aria-label={`Tirar marcador ${t.name}`} onClick={() => toggleTag(id, false)} className="flex size-5 items-center justify-center rounded-full hover:bg-card pointer-coarse:size-8">
                    <X className="size-3" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
          {freeTags.length ? (
            <DropdownMenu open={addingTag} onOpenChange={setAddingTag}>
              <DropdownMenuTrigger render={<button type="button" className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed px-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted pointer-coarse:h-10" />}>
                <Plus className="size-3" aria-hidden />
                Adicionar
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-44">
                {freeTags.map((t) => (
                  <DropdownMenuItem key={t.id} className="pointer-coarse:min-h-11" onClick={() => toggleTag(t.id, true)}>
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: t.color }} aria-hidden />
                    {t.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        <div className="space-y-3 px-5">
          {error ? <FormMessage state={{ status: "error", message: error }} /> : null}
          {notice ? <FormMessage state={{ status: "success", message: notice }} /> : null}

          {asking === "cancel" ? (
            <div className="space-y-3 rounded-xl border p-3.5">
              <p className="text-sm font-semibold">Motivo da desmarcação</p>
              <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label="Motivo">
                {(Object.keys(cancelReasonLabels) as CancelReason[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={reason === r}
                    onClick={() => setReason(r)}
                    className={cn("h-9 rounded-lg border px-2 text-sm pointer-coarse:h-11", reason === r ? "border-foreground bg-foreground font-semibold text-background" : "hover:bg-muted")}
                  >
                    {cancelReasonLabels[r]}
                  </button>
                ))}
              </div>
              <Input aria-label="Observação da desmarcação" placeholder="Observação (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" disabled={pending} onClick={() => changeStatus("canceled", { cancelReason: reason, cancelNote: note })}>
                  Desmarcar consulta
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAsking(null)}>
                  Voltar
                </Button>
              </div>
            </div>
          ) : null}

          {matches ? (
            <div className="space-y-2 rounded-xl border p-3.5">
              <p className="text-sm font-semibold">{matches.length ? "Da lista de espera, cabem neste horário:" : "Ninguém da lista de espera cabe neste horário."}</p>
              {matches.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    {m.patientName}
                    {m.notes ? <span className="text-muted-foreground"> · {m.notes}</span> : null}
                  </span>
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await fillFromWaitlist(m.id, a.id);
                        if (r.error) setError(r.error);
                        else onDone();
                      })
                    }
                  >
                    Encaixar
                  </Button>
                </div>
              ))}
              <Button size="sm" variant="ghost" onClick={() => onDone()}>
                Fechar
              </Button>
            </div>
          ) : null}

          {asking === "return" ? (
            <div className="space-y-3 rounded-xl border p-3.5">
              <p className="text-sm font-semibold">Definir alerta de retorno?</p>
              <div className="flex items-end gap-2">
                <div className="space-y-1.5">
                  <label htmlFor="return-months" className="text-sm">
                    Retorno em (meses)
                  </label>
                  <Input id="return-months" inputMode="numeric" className="w-24" value={months} onChange={(e) => setMonths(e.target.value)} />
                </div>
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const n = Number(months);
                      if (!Number.isInteger(n) || n < 1 || n > 60) return setError("Meses entre 1 e 60.");
                      const r = await createReturn({ patientId: a.patientId, months: n, reason: a.type || a.procedures[0]?.name || "Retorno", professionalId: a.professionalId, procedureId: firstProcedureId, sourceAppointmentId: a.id });
                      if (r.error) setError(r.error);
                      else setAsking(null);
                    })
                  }
                >
                  Agendar alerta
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAsking(null)}>
                  Sem retorno
                </Button>
              </div>
            </div>
          ) : null}

          {asking === "delete" ? (
            <div role="alertdialog" aria-label="Excluir consulta" className="space-y-3 rounded-xl border border-destructive/30 bg-destructive-soft p-3.5">
              <p className="text-sm font-semibold">Excluir a consulta de vez? Ela some da agenda e dos relatórios. Para registrar que o paciente não vem, use Desmarcar.</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await deleteAppointment(a.id);
                      if (r.error) setError(r.error);
                      else onDone("Consulta excluída.");
                    })
                  }
                >
                  Excluir consulta
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAsking(null)}>
                  Voltar
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Rodapé: quem agendou, situação e status */}
      <footer className="mt-4 space-y-3 border-t px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 space-y-0.5 text-xs leading-snug text-muted-foreground">
            <span className="block">{byLine}</span>
            <span className="block">{situation}</span>
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<button type="button" aria-label={`Status: ${statusLabels[status]}`} disabled={pending} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-input bg-card px-3 text-[0.8125rem] font-bold hover:bg-muted disabled:opacity-60 pointer-coarse:h-11" />}
            >
              <span className={cn("size-2 rounded-full", STATUS_DOT[status])} aria-hidden />
              {statusLabels[status]}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              {STATUS_ORDER.map((s) => (
                <DropdownMenuItem key={s} className="pointer-coarse:min-h-11" onClick={() => changeStatus(s)}>
                  <span className={cn("size-2 rounded-full", STATUS_DOT[s])} aria-hidden />
                  {statusLabels[s]}
                  {s === status ? <Check className="ml-auto size-4" aria-hidden /> : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <DropdownMenu>
            <DropdownMenuTrigger render={<button type="button" className="inline-flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground pointer-coarse:min-h-11" />}>
              <MoreHorizontal className="size-4" aria-hidden />
              Mais ações
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-52">
              {status !== "canceled" ? (
                <DropdownMenuItem className="pointer-coarse:min-h-11" onClick={() => changeStatus("canceled")}>
                  <X aria-hidden />
                  Desmarcar
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                className="pointer-coarse:min-h-11"
                onClick={() =>
                  startTransition(async () => {
                    const r = await addToWaitlist({ patientId: a.patientId, professionalId: a.professionalId, period: "any" });
                    if (r.error) setError(r.error);
                    else setNotice(`${firstName} entrou na lista de espera.`);
                  })
                }
              >
                <CalendarClock aria-hidden />
                Lista de espera
              </DropdownMenuItem>
              {canSendReminder && (status === "scheduled" || status === "confirmed") ? (
                <DropdownMenuItem
                  className="pointer-coarse:min-h-11"
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
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem className="pointer-coarse:min-h-11" onClick={() => window.open(`/agenda/comprovante/${a.id}`, "_blank", "noopener")}>
                <Printer aria-hidden />
                Imprimir comprovante
              </DropdownMenuItem>
              {card?.canDelete ? (
                <DropdownMenuItem variant="destructive" className="pointer-coarse:min-h-11" onClick={() => setAsking("delete")}>
                  <Trash2 aria-hidden />
                  Excluir
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
          {a.bookedOnline ? <span className="text-muted-foreground">· Agendada online</span> : null}
          <Link href={`/pacientes/${a.patientId}/agendamentos`} className={cn(buttonVariants({ variant: "link", size: "sm" }), "h-auto px-0 text-xs")}>
            Histórico de consultas
          </Link>
        </div>
      </footer>
    </div>
  );
}
