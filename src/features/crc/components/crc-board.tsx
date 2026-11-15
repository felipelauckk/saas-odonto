"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarPlus, ClipboardCheck, MessageCircle, Phone } from "lucide-react";
import { cn } from "cn";

import { EmptyState } from "@/components/feedback/empty-state";
import { FormMessage } from "@/components/forms/form-message";
import { SimpleSelect } from "@/components/forms/simple-select";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, formatCurrency } from "@/lib/format";
import { firstName, renderTemplate, toWhatsAppNumber } from "@/lib/messaging/render";
import { formatPhone } from "@/lib/documents";

import { logContact } from "../actions";
import { channelLabels, outcomeLabels, queueDescriptions, queueLabels, type CrcChannel, type CrcOutcome, type CrcQueue } from "../labels";
import { daysSince, type CrcBoardItem } from "../logic";

type Props = {
  queue: CrcQueue;
  items: CrcBoardItem[];
  laterCount: number;
  showingLater: boolean;
  template: string | null;
  clinicName: string;
  today: string;
};

const br = (iso: string) => iso.split("-").reverse().join("/");

function reasonText(item: CrcBoardItem, today: string) {
  const date = item.refDate;
  if (!date) return "";
  if (item.queue === "birthdays") return date === today ? "Aniversário hoje" : `Aniversário em ${br(date).slice(0, 5)}`;
  const prefix: Record<Exclude<CrcQueue, "birthdays">, string> = {
    open_quotes: "Apresentado em",
    untreated: "Aprovado em",
    no_shows: "Faltou em",
    first_visit_no_shows: "Faltou em",
    overdue_returns: "Retorno venceu em",
    overdue_payments: "Vencido desde",
  };
  const days = daysSince(date, today) ?? 0;
  return `${prefix[item.queue]} ${br(date)} · ${days === 0 ? "hoje" : days === 1 ? "há 1 dia" : `há ${days} dias`}`;
}

function ageClass(item: CrcBoardItem, today: string) {
  if (item.queue === "birthdays") return "";
  const days = daysSince(item.refDate, today) ?? 0;
  return days > 30 ? "text-destructive" : days > 7 ? "text-amber-700 dark:text-amber-500" : "";
}

export function CrcBoard({ queue, items, laterCount, showingLater, template, clinicName, today }: Props) {
  const router = useRouter();
  const [registering, setRegistering] = useState<CrcBoardItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function quickLog(item: CrcBoardItem, channel: CrcChannel) {
    startTransition(async () => {
      const r = await logContact({
        queue: item.queue,
        itemKey: item.itemKey,
        patientId: item.patientId,
        refId: item.refId,
        amountCents: item.amountCents,
        channel,
        outcome: null,
      });
      if (r.error) setError(r.error);
    });
  }

  function whatsappHref(item: CrcBoardItem) {
    const number = toWhatsAppNumber(item.phone);
    if (!number) return null;
    const text = template
      ? renderTemplate(template, {
          paciente: firstName(item.patientName),
          clinica: clinicName,
          valor: item.amountCents ? formatCurrency(item.amountCents) : undefined,
        })
      : "";
    return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
  }

  return (
    <div className="min-w-0 flex-1 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{queueLabels[queue]}</h2>
          <p className="text-sm text-muted-foreground">{queueDescriptions[queue]}</p>
        </div>
        {laterCount || showingLater ? (
          <Link
            href={showingLater ? `/crc?fila=${queue}` : `/crc?fila=${queue}&ver=depois`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {showingLater ? "Voltar para a fila" : `Para depois (${laterCount})`}
          </Link>
        ) : null}
      </div>

      {error ? <FormMessage state={{ status: "error", message: error }} /> : null}

      {items.length ? (
        <ul className="divide-y rounded-xl border">
          {items.map((item) => {
            const last = item.contacts[0];
            const wa = whatsappHref(item);
            return (
              <li key={`${item.queue}-${item.itemKey}`} className="space-y-2 px-4 py-3 sm:px-5">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <Link href={`/pacientes/${item.patientId}`} className="font-medium hover:underline">
                      {item.patientName}
                    </Link>
                    <p className={cn("text-sm text-muted-foreground", ageClass(item, today))}>{reasonText(item, today)}</p>
                    <p className="text-sm text-muted-foreground">
                      {last
                        ? `Último contato: ${formatDateTime(last.createdAt)} · ${channelLabels[last.channel]}${last.outcome ? ` · ${outcomeLabels[last.outcome]}` : ""}${item.contacts.length > 1 ? ` (${item.contacts.length} contatos)` : ""}`
                        : "Nenhum contato ainda"}
                      {item.laterOn ? ` · Próximo contato em ${br(item.laterOn)}` : ""}
                    </p>
                  </div>
                  {item.amountCents ? <p className="shrink-0 font-medium tabular-nums">{formatCurrency(item.amountCents)}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {wa ? (
                    <a href={wa} target="_blank" rel="noreferrer" onClick={() => quickLog(item, "whatsapp")} className={buttonVariants({ variant: "outline", size: "sm" })}>
                      <MessageCircle aria-hidden />
                      WhatsApp
                    </a>
                  ) : null}
                  {item.phone ? (
                    <a href={`tel:${item.phone}`} onClick={() => quickLog(item, "call")} className={buttonVariants({ variant: "outline", size: "sm" })} aria-label={`Ligar para ${formatPhone(item.phone)}`}>
                      <Phone aria-hidden />
                      Ligar
                    </a>
                  ) : null}
                  <Link href={`/agenda?paciente=${item.patientId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    <CalendarPlus aria-hidden />
                    Agendar
                  </Link>
                  <Button size="sm" onClick={() => setRegistering(item)}>
                    <ClipboardCheck aria-hidden />
                    Registrar contato
                  </Button>
                </div>
                {item.contacts.length ? (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-muted-foreground">Histórico</summary>
                    <ul className="mt-2 space-y-1 border-l pl-3">
                      {item.contacts.map((c) => (
                        <li key={c.id}>
                          <span className="tabular-nums">{formatDateTime(c.createdAt)}</span> · {channelLabels[c.channel]}
                          {c.outcome ? ` · ${outcomeLabels[c.outcome]}` : ""}
                          {c.nextContactOn ? ` · retomar em ${br(c.nextContactOn)}` : ""}
                          {c.authorName ? <span className="text-muted-foreground"> · {c.authorName}</span> : null}
                          {c.notes ? <p className="text-muted-foreground">{c.notes}</p> : null}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          icon={ClipboardCheck}
          title={showingLater ? "Nada marcado para depois" : "Fila em dia"}
          description={showingLater ? undefined : "Ninguém nesta fila precisa de contato agora."}
        />
      )}

      <Dialog open={registering !== null} onOpenChange={(open) => !open && setRegistering(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar contato{registering ? ` · ${registering.patientName}` : ""}</DialogTitle>
          </DialogHeader>
          {registering ? <ContactForm
              item={registering}
              today={today}
              onCancel={() => setRegistering(null)}
              onDone={() => {
                setRegistering(null);
                // Fica na mesma fila mesmo que ela esvazie.
                router.replace(`/crc?fila=${queue}${showingLater ? "&ver=depois" : ""}`, { scroll: false });
              }}
            /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ContactForm({ item, today, onDone, onCancel }: { item: CrcBoardItem; today: string; onDone: () => void; onCancel: () => void }) {
  const [channel, setChannel] = useState<CrcChannel>("call");
  const [outcome, setOutcome] = useState<CrcOutcome | null>(null);
  const [notes, setNotes] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!outcome) return setError("Escolha o resultado do contato.");
    if (next && next <= today) return setError("O próximo contato precisa ser depois de hoje.");
    startTransition(async () => {
      const r = await logContact({
        queue: item.queue,
        itemKey: item.itemKey,
        patientId: item.patientId,
        refId: item.refId,
        amountCents: item.amountCents,
        channel,
        outcome,
        notes,
        nextContactOn: outcome === "not_interested" || outcome === "scheduled" ? null : next || null,
      });
      if (r.error) setError(r.error);
      else onDone();
    });
  }

  return (
    <div className="space-y-4">
      {error ? <FormMessage state={{ status: "error", message: error }} /> : null}
      <SimpleSelect
        id="crc-channel"
        label="Como foi o contato"
        value={channel}
        onChange={(v) => setChannel(v as CrcChannel)}
        options={(Object.keys(channelLabels) as CrcChannel[]).map((c) => ({ value: c, label: channelLabels[c] }))}
      />
      <div className="space-y-1.5">
        <p className="text-sm font-medium" id="crc-outcome">Resultado</p>
        <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="crc-outcome">
          {(Object.keys(outcomeLabels) as CrcOutcome[]).map((o) => (
            <button
              key={o}
              type="button"
              aria-pressed={outcome === o}
              onClick={() => setOutcome(o)}
              className={cn(
                "h-9 rounded-lg border px-2 text-sm font-medium transition-colors pointer-coarse:h-11",
                outcome === o ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              {outcomeLabels[o]}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="crc-notes">Observação (opcional)</Label>
        <Textarea id="crc-notes" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {outcome !== "not_interested" && outcome !== "scheduled" ? (
        <div className="space-y-1.5">
          <Label htmlFor="crc-next">Próximo contato (opcional)</Label>
          <Input id="crc-next" type="date" min={today} value={next} onChange={(e) => setNext(e.target.value)} />
          <p className="text-xs text-muted-foreground">O paciente sai da fila até essa data.</p>
        </div>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button disabled={pending} onClick={submit}>Registrar</Button>
      </div>
    </div>
  );
}
