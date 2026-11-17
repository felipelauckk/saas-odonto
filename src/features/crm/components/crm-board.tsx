"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarPlus, MessageCircle, Pencil, Plus, UserCheck } from "lucide-react";
import { cn } from "cn";

import { FormDialog } from "@/components/forms/form-dialog";
import { FormMessage } from "@/components/forms/form-message";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPhone } from "@/lib/documents";
import { toWhatsAppNumber } from "@/lib/messaging/render";

import { convertLead, moveLead, saveLead } from "../actions";
import { leadSources, sourceLabels, type LeadSource } from "../labels";
import type { CrmLead, CrmStage } from "../queries";
import { LeadFields, type LeadOptions } from "./lead-fields";

type Props = { stages: CrmStage[]; leads: CrmLead[]; options: LeadOptions; now: number };

const STAGE_DOT = { open: "bg-warning", won: "bg-success", lost: "bg-destructive" } as const;

/** Origem do lead: cor + nome escrito (a cor nunca é o único sinal). */
const SOURCE_PILL: Record<LeadSource, string> = {
  instagram: "bg-source-instagram-soft text-source-instagram",
  google: "bg-source-google-soft text-source-google",
  indicacao: "bg-success-soft text-success",
  site: "bg-accent text-accent-foreground",
  anuncio: "bg-warning-soft text-warning",
  passante: "bg-muted text-muted-foreground",
  outro: "bg-muted text-muted-foreground",
};

function daysIn(lead: CrmLead, now: number) {
  return Math.floor((now - Date.parse(lead.stageChangedAt)) / 86_400_000);
}

export function NewLeadButton({ options }: { options: LeadOptions }) {
  return (
    <FormDialog title="Novo lead" action={saveLead} submitLabel="Criar lead" trigger={<Button><Plus aria-hidden />Novo lead</Button>}>
      {(state) => <LeadFields state={state} options={options} />}
    </FormDialog>
  );
}

export function CrmBoard({ stages, leads, options, now }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [losing, setLosing] = useState<{ lead: CrmLead; stageId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");

  const [source, setSource] = useState<LeadSource | null>(null);
  const sources = useMemo(() => leadSources.filter((s) => leads.some((l) => l.source === s)), [leads]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((l) => (!source || l.source === source) && (!q || `${l.name} ${l.phone ?? ""}`.toLowerCase().includes(q)));
  }, [leads, query, source]);
  const kindOf = (l: CrmLead) => stages.find((st) => st.id === l.stageId)?.kind ?? "open";
  const funnel = {
    open: visible.filter((l) => kindOf(l) === "open").length,
    won: visible.filter((l) => kindOf(l) === "won").length,
    lost: visible.filter((l) => kindOf(l) === "lost").length,
  };
  const conversion = funnel.won + funnel.lost ? Math.round((funnel.won / (funnel.won + funnel.lost)) * 100) : null;
  const selected = leads.find((l) => l.id === selectedId) ?? null;
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const campaignName = new Map(options.campaigns.map((c) => [c.id, c.name]));

  function move(lead: CrmLead, stageId: string) {
    if (lead.stageId === stageId) return;
    if (stageById.get(stageId)?.kind === "lost") {
      setLosing({ lead, stageId });
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await moveLead({ id: lead.id, stageId });
      if (r.error) setError(r.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Input type="search" placeholder="Buscar lead por nome ou telefone" aria-label="Buscar lead" value={query} onChange={(e) => setQuery(e.target.value)} className="lg:max-w-sm" />
        {sources.length > 1 ? (
          <div role="group" aria-label="Origem" className="-mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:px-0">
            {[null, ...sources].map((src) => (
              <button
                key={src ?? "todas"}
                type="button"
                aria-pressed={source === src}
                onClick={() => setSource(src)}
                className={cn(
                  "h-9 shrink-0 rounded-lg px-3 text-[0.8125rem] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40 pointer-coarse:h-11",
                  source === src ? "bg-card text-foreground shadow-segment" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {src ? sourceLabels[src] : "Todas"}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <dl aria-label="Conversão" className="grid grid-cols-2 gap-px overflow-hidden rounded-card border bg-border-soft sm:grid-cols-4">
        {[
          { label: "No funil", value: String(funnel.open) },
          { label: "Fecharam", value: String(funnel.won) },
          { label: "Perdidos", value: String(funnel.lost) },
          { label: "Conversão", value: conversion === null ? "—" : `${conversion}%` },
        ].map((k) => (
          <div key={k.label} className="flex flex-col gap-0.5 bg-card px-4 py-3">
            <dt className="type-label text-muted-foreground">{k.label}</dt>
            <dd className="text-xl font-semibold tabular-nums">{k.value}</dd>
          </div>
        ))}
      </dl>
      {error ? <FormMessage state={{ status: "error", message: error }} /> : null}

      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-8 sm:px-8">
        <div className="flex gap-3">
          {stages.map((stage) => {
            const column = visible.filter((l) => l.stageId === stage.id);
            return (
              <section
                key={stage.id}
                aria-label={`${stage.name}, ${column.length} leads`}
                className={cn("flex w-72 shrink-0 flex-col gap-2 rounded-card bg-muted/60 p-2", dragOver === stage.id && "ring-2 ring-primary")}
                onDragOver={(e) => { e.preventDefault(); setDragOver(stage.id); }}
                onDragLeave={() => setDragOver((v) => (v === stage.id ? null : v))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(null);
                  const lead = leads.find((l) => l.id === e.dataTransfer.getData("text/plain"));
                  if (lead) move(lead, stage.id);
                }}
              >
                <h2 className="flex items-center justify-between gap-2 px-1.5 py-1 text-sm font-semibold">
                  <span className="flex items-center gap-2">
                    <span aria-hidden className={cn("size-2 rounded-full", STAGE_DOT[stage.kind])} />
                    {stage.name}
                  </span>
                  <span className="rounded-full bg-card px-2 py-0.5 text-xs font-bold tabular-nums">{column.length}</span>
                </h2>
                {column.length === 0 ? <p className="px-1.5 py-3 text-center text-xs text-muted-foreground">Nenhum lead</p> : null}
                {column.map((lead) => {
                  const days = daysIn(lead, now);
                  return (
                    <button
                      key={lead.id}
                      type="button"
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", lead.id)}
                      onClick={() => setSelectedId(lead.id)}
                      className="space-y-1.5 rounded-xl border border-border-soft bg-card p-3 text-left text-sm shadow-segment hover:border-border focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      <span className="block font-semibold">{lead.name}</span>
                      <span className="flex items-baseline gap-1.5 text-xs">
                        <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 font-semibold", SOURCE_PILL[lead.source])}>{sourceLabels[lead.source]}</span>
                        {lead.interest || lead.campaignId ? (
                          <span className="min-w-0 text-muted-foreground">
                            {[lead.interest, lead.campaignId ? campaignName.get(lead.campaignId) : null].filter(Boolean).join(" · ")}
                          </span>
                        ) : null}
                      </span>
                      <span className="flex flex-wrap items-center gap-1.5 text-xs">
                        {lead.patientId ? <Badge variant="secondary">Paciente</Badge> : null}
                        {lead.fromPublicForm ? <Badge variant="outline">Site</Badge> : null}
                        {stage.kind === "open" ? (
                          <span className={cn("ml-auto font-medium text-muted-foreground", days > 14 ? "text-destructive" : days > 7 && "text-warning")}>
                            {days === 0 ? "hoje" : days === 1 ? "há 1 dia" : `há ${days} dias`}
                          </span>
                        ) : null}
                        {lead.lostReason ? <span className="text-muted-foreground">{lead.lostReason}</span> : null}
                      </span>
                    </button>
                  );
                })}
              </section>
            );
          })}
        </div>
      </div>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent>
          {selected ? (
            <LeadDetails
              lead={selected}
              stages={stages}
              options={options}
              pending={pending}
              onMove={(stageId) => move(selected, stageId)}
              onConvert={() =>
                startTransition(async () => {
                  const r = await convertLead(selected.id);
                  if (r.error) setError(r.error);
                })
              }
              onSchedule={() =>
                startTransition(async () => {
                  const r = await convertLead(selected.id);
                  if (r.error) setError(r.error);
                  else router.push(`/agenda?paciente=${r.patientId}`);
                })
              }
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={losing !== null} onOpenChange={(open) => !open && setLosing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Motivo da perda</DialogTitle>
          </DialogHeader>
          {losing ? (
            <LostForm
              onCancel={() => setLosing(null)}
              onConfirm={(reason) =>
                startTransition(async () => {
                  const r = await moveLead({ id: losing.lead.id, stageId: losing.stageId, lostReason: reason });
                  if (r.error) setError(r.error);
                  setLosing(null);
                  setSelectedId(null);
                })
              }
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const LOST_REASONS = ["Achou caro", "Escolheu outra clínica", "Sem resposta", "Sem interesse agora", "Fora da área"];

function LostForm({ onConfirm, onCancel }: { onConfirm: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState("");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {LOST_REASONS.map((r) => (
          <button key={r} type="button" aria-pressed={reason === r} onClick={() => setReason(r)}
            className={cn("h-8 rounded-full border px-3 text-sm pointer-coarse:h-11", reason === r ? "border-primary bg-primary/10" : "hover:bg-muted")}>
            {r}
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lost-reason">Motivo</Label>
        <Input id="lost-reason" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button variant="destructive" disabled={!reason.trim()} onClick={() => onConfirm(reason.trim())}>Marcar como perdido</Button>
      </div>
    </div>
  );
}

function LeadDetails({
  lead,
  stages,
  options,
  pending,
  onMove,
  onConvert,
  onSchedule,
}: {
  lead: CrmLead;
  stages: CrmStage[];
  options: LeadOptions;
  pending: boolean;
  onMove: (stageId: string) => void;
  onConvert: () => void;
  onSchedule: () => void;
}) {
  const wa = toWhatsAppNumber(lead.phone);
  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle>{lead.name}</DialogTitle>
      </DialogHeader>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-muted-foreground">Telefone</dt>
        <dd>{lead.phone ? formatPhone(lead.phone) : "—"}</dd>
        <dt className="text-muted-foreground">Origem</dt>
        <dd>{sourceLabels[lead.source]}</dd>
        {lead.referralName ? (
          <>
            <dt className="text-muted-foreground">Indicado por</dt>
            <dd>{lead.referralName}</dd>
          </>
        ) : null}
        {lead.interest ? (
          <>
            <dt className="text-muted-foreground">Interesse</dt>
            <dd>{lead.interest}</dd>
          </>
        ) : null}
      </dl>
      {lead.notes ? <p className="whitespace-pre-line text-sm">{lead.notes}</p> : null}

      <div className="space-y-1.5">
        <p className="text-sm font-medium" id="lead-stage">Etapa</p>
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby="lead-stage">
          {stages.map((s) => (
            <button key={s.id} type="button" disabled={pending} aria-pressed={lead.stageId === s.id} onClick={() => onMove(s.id)}
              className={cn("h-8 rounded-full border px-3 text-sm disabled:opacity-60 pointer-coarse:h-11",
                lead.stageId === s.id ? (s.kind === "lost" ? "border-destructive bg-destructive/10 text-destructive" : "border-primary bg-primary text-primary-foreground") : "hover:bg-muted")}>
              {s.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {wa ? (
          <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <MessageCircle aria-hidden />
            WhatsApp
          </a>
        ) : null}
        {lead.patientId ? (
          <Link href={`/pacientes/${lead.patientId}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <UserCheck aria-hidden />
            Ver paciente
          </Link>
        ) : (
          <Button variant="outline" size="sm" disabled={pending} onClick={onConvert}>
            <UserCheck aria-hidden />
            Converter em paciente
          </Button>
        )}
        <Button size="sm" disabled={pending} onClick={onSchedule}>
          <CalendarPlus aria-hidden />
          Agendar avaliação
        </Button>
        <FormDialog title="Editar lead" action={saveLead} trigger={<Button variant="ghost" size="sm"><Pencil aria-hidden />Editar</Button>}>
          {(state) => <LeadFields lead={lead} state={state} options={options} />}
        </FormDialog>
      </div>
    </div>
  );
}
