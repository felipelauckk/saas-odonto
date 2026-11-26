"use client";

import { useState, useTransition } from "react";
import { cn } from "cn";

import { FormMessage } from "@/components/forms/form-message";
import { SimpleSelect } from "@/components/forms/simple-select";
import { SegmentedControl } from "@/components/app/segmented-control";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { minutesToTime, timeToMinutes, weekdayOf } from "@/lib/timezone";

import { saveCommitment } from "../actions";
import { COMMITMENT_SUGGESTIONS, commitmentRepeatLabels, MAX_OCCURRENCES, pickRange, type CommitmentRepeat } from "../commitments";
import { OUTSIDE_HOURS } from "../free-slots";
import type { AgendaData } from "../queries";
import type { CommitmentScope } from "../schemas";

import { Choice, EntryFooter, EntryHeader, Section, shortDate, type EntryTab } from "./entry-parts";

export type CommitmentFormValues = {
  id?: string;
  seriesId: string | null;
  title: string;
  notes: string;
  target: "professional" | "clinic";
  professionalId: string;
  kind: "block" | "event";
  date: string;
  allDay: boolean;
  startMin: number | null;
  endMin: number | null;
};

export function newCommitmentValues(v: Pick<CommitmentFormValues, "professionalId" | "date"> & Partial<CommitmentFormValues>): CommitmentFormValues {
  return { seriesId: null, title: "", notes: "", target: "professional", kind: "block", allDay: false, startMin: null, endMin: null, ...v };
}

type Props = {
  initial: CommitmentFormValues;
  professionals: { id: string; name: string }[];
  schedules: AgendaData["schedules"];
  /** Dentista só marca na própria agenda (nada de "Clínica toda"). */
  isDentist: boolean;
  onDone: (message?: string) => void;
  onCancel: () => void;
  onSwitchTab?: (tab: EntryTab) => void;
};

const STEP = 15;
const fmtDate = (d: string) => d.split("-").reverse().join("/");

export const scopeLabels: Record<CommitmentScope, string> = { one: "Só este", following: "Este e os próximos", all: "Todos" };

/** Faixa de horários oferecida: expediente do profissional (ou de todos), ou o dia todo. */
function timeWindow(schedules: AgendaData["schedules"], date: string, professionalId: string | null, wholeDay: boolean, keep: (number | null)[]) {
  const weekday = weekdayOf(date);
  const day = schedules.filter((s) => s.weekday === weekday && (!professionalId || s.professional_id === professionalId));
  let start = day.length ? Math.min(...day.map((s) => timeToMinutes(s.start_time.slice(0, 5)))) : 8 * 60;
  let end = day.length ? Math.max(...day.map((s) => timeToMinutes(s.end_time.slice(0, 5)))) : 18 * 60;
  if (wholeDay) {
    start = Math.min(start, OUTSIDE_HOURS.startMin);
    end = Math.max(end, OUTSIDE_HOURS.endMin);
  }
  // O que já está escolhido continua visível.
  for (const k of keep) {
    if (k === null) continue;
    start = Math.min(start, Math.floor(k / 60) * 60);
    end = Math.max(end, Math.ceil(k / 60) * 60);
  }
  const marks: number[] = [];
  for (let m = start; m < end; m += STEP) marks.push(m);
  return { marks, hasSchedule: day.length > 0 };
}

export function CommitmentForm({ initial, professionals, schedules, isDentist, onDone, onCancel, onSwitchTab }: Props) {
  const [v, setV] = useState(initial);
  const [repeat, setRepeat] = useState<CommitmentRepeat>("none");
  const [endMode, setEndMode] = useState<"until" | "count">("until");
  const [until, setUntil] = useState("");
  const [count, setCount] = useState("4");
  const [wholeDay, setWholeDay] = useState(false);
  const [askScope, setAskScope] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeError, setTimeError] = useState<string | undefined>();
  const [titleError, setTitleError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof CommitmentFormValues>(key: K, value: CommitmentFormValues[K]) => setV((x) => ({ ...x, [key]: value }));

  const isEdit = Boolean(v.id);
  const inSeries = isEdit && Boolean(v.seriesId);
  const target = isDentist ? "professional" : v.target;
  const professionalId = target === "clinic" ? null : v.professionalId;
  const whoName = target === "clinic" ? "Clínica toda" : (professionals.find((p) => p.id === v.professionalId)?.name ?? "Profissional");
  const { marks, hasSchedule } = timeWindow(schedules, v.date, professionalId, wholeDay, [v.startMin, v.endMin === null ? null : v.endMin - STEP]);

  function clickMark(m: number) {
    const next = pickRange({ startMin: v.startMin, endMin: v.endMin }, m, STEP);
    setV((x) => ({ ...x, startMin: next.startMin, endMin: next.endMin }));
    setTimeError(undefined);
  }

  function validate() {
    let ok = true;
    if (!v.title.trim()) {
      setTitleError("Dê um nome ao compromisso.");
      ok = false;
    }
    if (!v.allDay && (v.startMin === null || v.endMin === null)) {
      setTimeError(v.startMin === null ? "Escolha o início e o fim nos horários." : "Agora escolha o horário do fim.");
      ok = false;
    }
    if (repeat !== "none" && endMode === "until" && !until) {
      setError("Diga até quando o compromisso se repete.");
      ok = false;
    }
    return ok;
  }

  function save(scope: CommitmentScope) {
    setError(null);
    startTransition(async () => {
      const result = await saveCommitment({
        id: v.id,
        scope,
        title: v.title,
        notes: v.notes,
        professionalId: professionalId ?? "",
        kind: v.kind,
        date: v.date,
        allDay: v.allDay,
        startTime: v.allDay || v.startMin === null ? "00:00" : minutesToTime(v.startMin),
        endTime: v.allDay || v.endMin === null ? "24:00" : v.endMin >= 24 * 60 ? "24:00" : minutesToTime(v.endMin),
        repeat: isEdit ? "none" : repeat,
        until: !isEdit && repeat !== "none" && endMode === "until" ? until : null,
        count: !isEdit && repeat !== "none" && endMode === "count" ? Math.min(Math.max(Number(count) || 2, 2), MAX_OCCURRENCES) : null,
      });
      setAskScope(false);
      if (result.error) {
        setError(result.skipped?.length ? `${result.error} (${result.skipped.map(fmtDate).join(", ")})` : result.error);
        return;
      }
      const skipped = result.skipped?.length
        ? ` ${result.skipped.length === 1 ? "1 data não foi" : `${result.skipped.length} datas não foram`} ${isEdit ? "alterada" : "criada"}${result.skipped.length === 1 ? "" : "s"} porque já ${result.skipped.length === 1 ? "tem" : "têm"} consulta: ${result.skipped.map(fmtDate).join(", ")}.`
        : "";
      const done = isEdit ? (result.updated && result.updated > 1 ? `${result.updated} compromissos alterados.` : "Compromisso alterado.") : result.created && result.created > 1 ? `${result.created} compromissos criados.` : "Compromisso criado.";
      onDone(`${done}${skipped}`);
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    if (inSeries) setAskScope(true);
    else save("one");
  }

  const timeText = v.allDay ? "dia inteiro" : v.startMin !== null && v.endMin !== null ? `${minutesToTime(v.startMin)}–${minutesToTime(Math.min(v.endMin, 24 * 60 - 1))}` : "escolha o horário";
  const summary = [shortDate(v.date), timeText, whoName].join(" · ");

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
      <EntryHeader tab="compromisso" onTab={isEdit ? undefined : onSwitchTab} title={isEdit ? "Editar compromisso" : "Novo compromisso"} />

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
        {error ? <FormMessage state={{ status: "error", message: error }} /> : null}

        <Section>
          <div className="space-y-2">
            <Label htmlFor="commitment-title">Nome</Label>
            <Input
              id="commitment-title"
              value={v.title}
              maxLength={120}
              placeholder="Ex.: Almoço, curso, reunião"
              aria-invalid={titleError ? true : undefined}
              onChange={(e) => {
                set("title", e.target.value);
                setTitleError(undefined);
              }}
            />
            {titleError ? <p className="text-sm text-destructive">{titleError}</p> : null}
            <div className="flex flex-wrap gap-2" role="group" aria-label="Sugestões de nome">
              {COMMITMENT_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={v.title === s}
                  onClick={() => {
                    set("title", s);
                    setTitleError(undefined);
                  }}
                  className={cn(
                    "inline-flex h-8 items-center rounded-full border px-3 text-[0.8125rem] font-medium transition-colors pointer-coarse:h-11",
                    v.title === s ? "border-foreground bg-foreground font-semibold text-background" : "border-input bg-card hover:bg-muted",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium" id="commitment-for">
              Para
            </span>
            {isDentist ? null : (
              <div>
                <SegmentedControl
                  label="Para"
                  value={v.target}
                  onChange={(t) => set("target", t)}
                  options={[
                    { value: "professional", label: "Profissional" },
                    { value: "clinic", label: "Clínica toda" },
                  ]}
                />
              </div>
            )}
            {target === "professional" ? (
              <SimpleSelect
                id="commitment-professional"
                label="Profissional"
                value={v.professionalId}
                onChange={(id) => set("professionalId", id)}
                options={professionals.map((p) => ({ value: p.id, label: p.name }))}
              />
            ) : (
              <p className="text-[0.8125rem] text-muted-foreground">Vale para todos os profissionais desta unidade.</p>
            )}
          </div>

          <label className="flex items-start justify-between gap-4 rounded-lg border px-3 py-3">
            <span className="space-y-0.5">
              <span className="block text-sm font-medium">Bloqueia a agenda?</span>
              <span className="block text-[0.8125rem] text-muted-foreground">
                {v.kind === "block" ? "Ninguém consegue marcar consulta nesse horário." : "Só um lembrete na agenda: consultas continuam podendo ser marcadas."}
              </span>
            </span>
            <Switch checked={v.kind === "block"} onCheckedChange={(on) => set("kind", on ? "block" : "event")} aria-label="Bloqueia a agenda" className="mt-1" />
          </label>
        </Section>

        <Section title="Quando">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="commitment-date">Data</Label>
              <Input id="commitment-date" type="date" value={v.date} onChange={(e) => e.target.value && set("date", e.target.value)} />
              {inSeries ? <p className="text-xs text-muted-foreground">Numa série, mudar a data só vale para &quot;Só este&quot;; nos outros, cada ocorrência fica no seu dia.</p> : null}
            </div>
            <label className="flex h-10 items-center gap-3 text-sm font-medium pointer-coarse:h-11">
              <Switch checked={v.allDay} onCheckedChange={(on) => set("allDay", on)} aria-label="Dia inteiro" />
              Dia inteiro
            </label>
          </div>

          {v.allDay ? null : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="text-sm font-medium" id="commitment-times">
                  Horário <span className="font-normal text-muted-foreground">(clique no início e depois no fim)</span>
                </span>
                <button type="button" onClick={() => setWholeDay((w) => !w)} className="text-sm font-medium text-primary underline-offset-4 hover:underline pointer-coarse:min-h-11">
                  {wholeDay ? "Mostrar só o expediente" : "Mostrar dia todo"}
                </button>
              </div>
              {!hasSchedule && !wholeDay ? (
                <p className="text-[0.8125rem] text-muted-foreground">{target === "clinic" ? "Ninguém atende" : `${whoName} não atende`} neste dia; mostrando 8h às 18h.</p>
              ) : null}
              <div role="group" aria-labelledby="commitment-times" className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {marks.map((m) => {
                  const isStart = v.startMin === m;
                  const isEnd = v.endMin !== null && v.endMin - STEP === m;
                  const inside = v.startMin !== null && v.endMin !== null && m > v.startMin && m < v.endMin - STEP;
                  return (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={isStart || isEnd || inside}
                      aria-label={`${minutesToTime(m)}${isStart ? ", início" : isEnd ? ", fim" : ""}`}
                      onClick={() => clickMark(m)}
                      className={cn(
                        "h-10 rounded-lg border text-sm font-medium tabular-nums transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40 pointer-coarse:h-11",
                        isStart || isEnd ? "border-primary bg-primary text-primary-foreground" : inside ? "border-primary/30 bg-primary/10 text-foreground" : "border-input bg-card hover:bg-muted",
                      )}
                    >
                      {minutesToTime(m)}
                    </button>
                  );
                })}
              </div>
              {timeError ? <p className="text-sm text-destructive">{timeError}</p> : null}
            </div>
          )}

          {isEdit ? null : (
            <div className="space-y-2">
              <span className="text-sm font-medium">Repetição</span>
              <Choice label="Repetição" value={repeat} onChange={setRepeat} options={(Object.keys(commitmentRepeatLabels) as CommitmentRepeat[]).map((r) => ({ value: r, label: commitmentRepeatLabels[r] }))} />
              {repeat !== "none" ? (
                <div className="flex flex-wrap items-end gap-4 pt-1">
                  <Choice
                    label="Termina"
                    value={endMode}
                    onChange={setEndMode}
                    options={[
                      { value: "until", label: "Até" },
                      { value: "count", label: "Quantas vezes" },
                    ]}
                  />
                  {endMode === "until" ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="commitment-until">Até (data)</Label>
                      <Input id="commitment-until" type="date" min={v.date} value={until} onChange={(e) => setUntil(e.target.value)} className="w-44" />
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Label htmlFor="commitment-count">Quantas vezes</Label>
                      <Input id="commitment-count" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} className="w-28" />
                    </div>
                  )}
                  <p className="w-full text-xs text-muted-foreground">No máximo {MAX_OCCURRENCES} vezes. Datas que já têm consulta não são bloqueadas.</p>
                </div>
              ) : null}
            </div>
          )}
        </Section>

        <Section title="Observações">
          <Textarea id="commitment-notes" aria-label="Observações" rows={2} maxLength={1000} value={v.notes} onChange={(e) => set("notes", e.target.value)} />
        </Section>

        {askScope ? (
          <div role="alertdialog" aria-label="Aplicar a quais ocorrências" className="space-y-3 rounded-lg border border-primary/30 bg-accent/40 p-4">
            <p className="text-sm font-medium">Este compromisso se repete. Aplicar a alteração a:</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(scopeLabels) as CommitmentScope[]).map((s) => (
                <Button key={s} type="button" variant={s === "one" ? "default" : "outline"} disabled={pending} onClick={() => save(s)}>
                  {scopeLabels[s]}
                </Button>
              ))}
              <Button type="button" variant="ghost" onClick={() => setAskScope(false)}>
                Voltar
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <EntryFooter summary={summary}>
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1 sm:flex-none">
          Cancelar
        </Button>
        <Button type="submit" disabled={pending} className="flex-1 sm:flex-none">
          {pending ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar compromisso"}
        </Button>
      </EntryFooter>
    </form>
  );
}
