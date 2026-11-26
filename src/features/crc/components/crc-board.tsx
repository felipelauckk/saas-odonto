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
import { PressureBar } from "@/components/app/pressure-bar";
import { initials } from "@/lib/initials";

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
  return days > 20 ? "text-destructive" : days > 7 ? "text-warning" : "";
}

export function CrcBoard({ queue, items, laterCount, showingLater, template, clinicName, today }: Props) {
  const router = useRouter();
  const [registering, setRegistering] = useState<CrcBoardItem | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const selected = items.find((i) => i.itemKey === selectedKey) ?? items[0] ?? null;

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

  function suggestedMessage(item: CrcBoardItem) {
    return template
      ? renderTemplate(template, {
          paciente: firstName(item.patientName),
          clinica: clinicName,
          valor: item.amountCents ? formatCurrency(item.amountCents) : undefined,
        })
      : "";
  }

  return (
    <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
      <section aria-labelledby="fila-atual" className="min-w-0 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-0.5">
            <h2 id="fila-atual" className="type-section">
              {queueLabels[queue]}
              {showingLater ? " · para depois" : ""}
            </h2>
            <p className="text-[0.8125rem] text-muted-foreground">{queueDescriptions[queue]}</p>
          </div>
          {laterCount || showingLater ? (
            <Link href={showingLater ? `/crc?fila=${queue}` : `/crc?fila=${queue}&ver=depois`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              {showingLater ? "Voltar para a fila" : `Para depois (${laterCount})`}
            </Link>
          ) : null}
        </div>

        {error ? <FormMessage state={{ status: "error", message: error }} /> : null}

        {items.length ? (
          <ul className="overflow-hidden rounded-card border bg-card">
            {items.map((item) => {
              const last = item.contacts[0];
              const days = item.queue === "birthdays" ? 0 : (daysSince(item.refDate, today) ?? 0);
              const on = selected?.itemKey === item.itemKey;
              return (
                <li key={`${item.queue}-${item.itemKey}`} className="border-t border-border-soft first:border-t-0">
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      setSelectedKey(item.itemKey);
                      if (window.matchMedia("(max-width: 79.99rem)").matches) document.getElementById("contato-painel")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className={cn(
                      "flex w-full gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted",
                      on && "bg-background",
                    )}
                  >
                    <PressureBar days={days} />
                    <span className="min-w-0 flex-1 space-y-0.5">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-sm font-semibold">{item.patientName}</span>
                        {item.amountCents ? <span className="shrink-0 text-sm font-semibold tabular-nums">{formatCurrency(item.amountCents)}</span> : null}
                      </span>
                      <span className={cn("block text-[0.8125rem] text-muted-foreground", ageClass(item, today))}>{reasonText(item, today)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {last
                          ? `Último contato: ${formatDateTime(last.createdAt)} · ${channelLabels[last.channel]}${last.outcome ? ` · ${outcomeLabels[last.outcome]}` : ""}${item.contacts.length > 1 ? ` (${item.contacts.length} contatos)` : ""}`
                          : "Nenhum contato ainda"}
                        {item.laterOn ? ` · Próximo contato em ${br(item.laterOn)}` : ""}
                      </span>
                    </span>
                  </button>
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
      </section>

      {selected ? (
        <ContactPanel
          key={`${selected.queue}-${selected.itemKey}`}
          item={selected}
          today={today}
          initialMessage={suggestedMessage(selected)}
          onQuickLog={quickLog}
          onRegister={() => setRegistering(selected)}
        />
      ) : null}

      <Dialog open={registering !== null} onOpenChange={(open) => !open && setRegistering(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar contato{registering ? ` · ${registering.patientName}` : ""}</DialogTitle>
          </DialogHeader>
          {registering ? (
            <ContactForm
              item={registering}
              today={today}
              onCancel={() => setRegistering(null)}
              onDone={() => {
                setRegistering(null);
                // Fica na mesma fila mesmo que ela esvazie.
                router.replace(`/crc?fila=${queue}${showingLater ? "&ver=depois" : ""}`, { scroll: false });
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Painel do paciente escolhido: histórico, mensagem sugerida (editável) e ações. */
function ContactPanel({
  item,
  today,
  initialMessage,
  onQuickLog,
  onRegister,
}: {
  item: CrcBoardItem;
  today: string;
  initialMessage: string;
  onQuickLog: (item: CrcBoardItem, channel: CrcChannel) => void;
  onRegister: () => void;
}) {
  const [message, setMessage] = useState(initialMessage);
  const number = toWhatsAppNumber(item.phone);
  const wa = number ? `https://wa.me/${number}${message.trim() ? `?text=${encodeURIComponent(message.trim())}` : ""}` : null;

  return (
    <section id="contato-painel" aria-labelledby="contato-nome" className="scroll-mt-4 space-y-4 rounded-card border bg-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-tint-sky text-sm font-black text-tint-sky-foreground">
          {initials(item.patientName)}
        </span>
        <div className="min-w-0 space-y-0.5">
          <h2 id="contato-nome" className="type-section">
            <Link href={`/pacientes/${item.patientId}`} className="hover:underline">
              {item.patientName}
            </Link>
          </h2>
          <p className="text-xs text-muted-foreground">{item.phone ? formatPhone(item.phone) : "Sem telefone"}</p>
        </div>
      </div>

      <div className="rounded-lg bg-muted px-3 py-2.5 text-[0.8125rem]">
        <p className="font-semibold">{queueLabels[item.queue]}</p>
        <p className={cn("text-muted-foreground", ageClass(item, today))}>
          {reasonText(item, today)}
          {item.amountCents ? ` · ${formatCurrency(item.amountCents)}` : ""}
        </p>
      </div>

      {item.contacts.length ? (
        <div className="space-y-1.5">
          <h3 className="type-label text-muted-foreground">Histórico</h3>
          <ol className="space-y-1.5">
            {item.contacts.map((c) => (
              <li key={c.id} className="flex gap-2.5 text-[0.8125rem] leading-snug">
                <span className="shrink-0 text-muted-foreground tabular-nums">{formatDateTime(c.createdAt).slice(0, 5)}</span>
                <span className="min-w-0">
                  {channelLabels[c.channel]}
                  {c.outcome ? ` · ${outcomeLabels[c.outcome]}` : ""}
                  {c.nextContactOn ? ` · retomar em ${br(c.nextContactOn)}` : ""}
                  {c.authorName ? <span className="text-muted-foreground"> · {c.authorName}</span> : null}
                  {c.notes ? <span className="block text-muted-foreground">{c.notes}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <p className="text-[0.8125rem] text-muted-foreground">Nenhum contato ainda.</p>
      )}

      {number ? (
        <div className="space-y-1.5">
          <Label htmlFor="crc-message">Mensagem sugerida</Label>
          <Textarea id="crc-message" rows={5} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        {wa ? (
          <a href={wa} target="_blank" rel="noreferrer" onClick={() => onQuickLog(item, "whatsapp")} className={buttonVariants({ className: "col-span-2" })}>
            <MessageCircle aria-hidden />
            Enviar no WhatsApp
          </a>
        ) : null}
        {item.phone ? (
          <a href={`tel:${item.phone}`} onClick={() => onQuickLog(item, "call")} className={buttonVariants({ variant: "outline" })} aria-label={`Ligar para ${formatPhone(item.phone)}`}>
            <Phone aria-hidden />
            Ligar
          </a>
        ) : null}
        <Link href={`/agenda?paciente=${item.patientId}`} className={buttonVariants({ variant: "outline" })}>
          <CalendarPlus aria-hidden />
          Agendar
        </Link>
        <Button variant="secondary" onClick={onRegister} className="col-span-2">
          <ClipboardCheck aria-hidden />
          Registrar contato
        </Button>
      </div>
    </section>
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
