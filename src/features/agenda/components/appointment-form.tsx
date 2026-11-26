"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { FormMessage } from "@/components/forms/form-message";
import { SimpleSelect } from "@/components/forms/simple-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { formatPhone } from "@/lib/documents";
import { minutesToTime, timeToMinutes } from "@/lib/timezone";
import { labWarnings } from "@/features/prosthetics/actions";
import { loadPatientForEdit } from "@/features/patients/actions";
import { PatientForm } from "@/features/patients/components/patient-form";
import type { Patient } from "@/features/patients/queries";

import { loadAppointmentPatient, saveAppointment, type AppointmentPatientInfo, type PatientOption } from "../actions";
import { repeatLabels, type Repeat } from "../advanced";
import { DURATION_OPTIONS } from "../labels";
import type { AgendaData } from "../queries";
import type { ConfirmationMode, ReminderMode } from "../schemas";

import { AppointmentProcedures, durationLabel, type FormProcedure } from "./appointment-procedures";
import { PatientPicker } from "./patient-picker";
import { Choice, EntryFooter, EntryHeader, Section, shortDate, type EntryTab } from "./entry-parts";
import { SlotPicker } from "./slot-picker";

export type AppointmentFormValues = {
  id?: string;
  patient: PatientOption | null;
  professionalId: string;
  chairId: string | null;
  procedures: FormProcedure[];
  date: string;
  /** Escolhido na grade; null até escolher. */
  time: string | null;
  durationMin: number;
  type: string;
  notes: string;
  tagIds: string[];
  confirmationMode: ConfirmationMode;
  reminderMode: ReminderMode;
};

/** Valores de uma consulta nova (o resto vem em branco). */
export function newAppointmentValues(v: Pick<AppointmentFormValues, "professionalId" | "date"> & Partial<AppointmentFormValues>): AppointmentFormValues {
  return {
    patient: null,
    chairId: null,
    procedures: [],
    time: null,
    durationMin: 30,
    type: "",
    notes: "",
    tagIds: [],
    confirmationMode: "auto",
    reminderMode: "auto",
    ...v,
  };
}

type Props = {
  initial: AppointmentFormValues;
  professionals: { id: string; name: string }[];
  chairs: { id: string; name: string }[];
  procedures: AgendaData["procedures"];
  tags: { id: string; name: string; color: string }[];
  today: string;
  /** Dentista não envia mensagens ("Enviar agora" some). */
  isDentist: boolean;
  onDone: (message?: string) => void;
  onCancel: () => void;
  /** Trocar para a aba Compromisso (só ao criar). */
  onSwitchTab?: (tab: EntryTab) => void;
  /** "Remarcar" no cartão: abre rolado até a grade de horários. */
  focusSlots?: boolean;
};

const alertText = (a: { label: string; details: string | null }) => {
  const label = a.label.replace(/\?\s*$/, "");
  return a.details ? `${label}: ${a.details}` : label;
};

export function AppointmentForm({
  initial,
  professionals,
  chairs,
  procedures,
  tags,
  today,
  isDentist,
  onDone,
  onCancel,
  onSwitchTab,
  focusSlots = false,
}: Props) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [patientError, setPatientError] = useState<string | undefined>();
  const [timeError, setTimeError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const [repeat, setRepeat] = useState<"none" | Repeat>("none");
  const [repeatCount, setRepeatCount] = useState("4");
  const [labOrders, setLabOrders] = useState<{
    patientId: string;
    list: Awaited<ReturnType<typeof labWarnings>>;
  }>({ patientId: "", list: [] });
  const [info, setInfo] = useState<{
    patientId: string;
    data: AppointmentPatientInfo | null;
  } | null>(null);
  const [editing, setEditing] = useState<{ status: "loading" } | { status: "ready"; patient: Patient } | null>(null);
  const patientId = values.patient?.id ?? null;

  const loadInfo = useCallback((id: string) => loadAppointmentPatient(id, initial.id ?? null).then((data) => setInfo({ patientId: id, data })), [initial.id]);

  // "Remarcar": rola até a grade de horários ao abrir.
  const slotsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusSlots) slotsRef.current?.scrollIntoView({ block: "start" });
  }, [focusSlots]);

  useEffect(() => {
    if (!patientId) return;
    let alive = true;
    labWarnings(patientId).then((list) => alive && setLabOrders({ patientId, list }));
    loadAppointmentPatient(patientId, initial.id ?? null).then((data) => alive && setInfo({ patientId, data }));
    return () => {
      alive = false;
    };
  }, [patientId, initial.id]);

  const patientInfo = info?.patientId === patientId ? info.data : null;
  // Trabalho ainda no laboratório: avisa se a consulta é antes do retorno previsto.
  const labConflicts = labOrders.patientId === patientId ? labOrders.list.filter((o) => values.date < o.expectedReturnOn) : [];
  const set = <K extends keyof AppointmentFormValues>(key: K, value: AppointmentFormValues[K]) => setValues((v) => ({ ...v, [key]: value }));

  const durations = [...new Set([...DURATION_OPTIONS, values.durationMin])].sort((a, b) => a - b);
  const professionalName = professionals.find((p) => p.id === values.professionalId)?.name ?? "Profissional";
  const isToday = values.date === today;
  const reminderMode: ReminderMode = isToday ? "auto" : values.reminderMode;

  function setProcedures(next: FormProcedure[]) {
    setValues((v) => {
      // A soma das durações dos procedimentos sugere a duração (lista vazia mantém a escolhida).
      const sum = next.reduce((s, p) => s + p.durationMin, 0);
      return {
        ...v,
        procedures: next,
        durationMin: next.length && sum > 0 ? Math.min(sum, 720) : v.durationMin,
      };
    });
  }

  async function openEdit() {
    if (!patientId) return;
    setEditing({ status: "loading" });
    const patient = await loadPatientForEdit(patientId);
    if (patient) setEditing({ status: "ready", patient });
    else {
      setEditing(null);
      setError("Não foi possível abrir o cadastro do paciente.");
    }
  }

  async function afterPatientSaved() {
    setEditing(null);
    if (!patientId) return;
    const fresh = await loadPatientForEdit(patientId);
    if (fresh)
      set("patient", {
        id: fresh.id,
        name: fresh.full_name,
        detail: fresh.whatsapp ?? fresh.phone ?? null,
      });
    await loadInfo(patientId);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    let invalid = false;
    if (!values.patient) {
      setPatientError("Escolha o paciente.");
      invalid = true;
    }
    if (!values.time) {
      setTimeError("Escolha o horário na grade.");
      invalid = true;
    }
    if (invalid) return;
    setError(null);
    startTransition(async () => {
      const result = await saveAppointment({
        id: values.id,
        patientId: values.patient!.id,
        professionalId: values.professionalId,
        chairId: values.chairId ?? "",
        procedures: values.procedures.map((p) => ({
          procedureId: p.procedureId,
          // Do plano: guarda o nome do item (o único nome quando foi escrito à mão).
          description: p.treatmentItemId ? p.name : null,
          treatmentItemId: p.treatmentItemId,
          tooth: p.tooth,
          faces: p.faces as ("M" | "D" | "O" | "V" | "L")[] | null,
        })),
        date: values.date,
        time: values.time!,
        durationMin: values.durationMin,
        type: values.type,
        notes: values.notes,
        tagIds: values.tagIds,
        repeat: repeat === "none" ? null : repeat,
        repeatCount: repeat === "none" ? undefined : Number(repeatCount),
        confirmationMode: values.confirmationMode,
        reminderMode,
      });
      const extra = result.notice ? ` ${result.notice}` : "";
      if (result.error && !result.id) setError(result.failed?.length ? `${result.error} Nenhuma data da série foi marcada.` : result.error);
      else if (result.error) onDone(`${result.error}${extra}`);
      else if (result.failed?.length) {
        onDone(
          `${result.created} consultas marcadas. Não deu para marcar: ${result.failed.map((f) => `${f.date.split("-").reverse().join("/")} (${f.reason})`).join("; ")}.${extra}`,
        );
      } else if (result.created && result.created > 1) onDone(`${result.created} consultas marcadas.${extra}`);
      else onDone(result.notice);
    });
  }

  const end = values.time ? minutesToTime(Math.min(timeToMinutes(values.time) + values.durationMin, 24 * 60 - 1)) : null;
  const summary = [shortDate(values.date), values.time ? `${values.time}–${end}` : "escolha o horário", professionalName].join(" · ");

  return (
    <>
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
        <EntryHeader tab="consulta" onTab={values.id || !onSwitchTab ? undefined : onSwitchTab} title={values.id ? "Editar consulta" : "Nova consulta"} />

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {error ? <FormMessage state={{ status: "error", message: error }} /> : null}
          {labConflicts.length ? (
            <p role="status" className="rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-warning">
              {labConflicts
                .map(
                  (o) => `${o.workType}${o.labName ? ` (${o.labName})` : ""} só volta do laboratório em ${o.expectedReturnOn.split("-").reverse().join("/")}`,
                )
                .join("; ")}
              . Confira antes de marcar.
            </p>
          ) : null}

          <Section>
            {values.id ? (
              <div className="space-y-1.5">
                <Label>Paciente</Label>
                <p className="rounded-lg border bg-muted/30 px-3 py-2 text-sm font-medium">{values.patient?.name}</p>
              </div>
            ) : (
              <PatientPicker
                value={values.patient}
                onChange={(p) => {
                  set("patient", p);
                  setPatientError(undefined);
                  // Itens do plano são do paciente anterior.
                  setProcedures(values.procedures.filter((x) => !x.treatmentItemId));
                }}
                error={patientError}
                hideDetail
              />
            )}
            {values.patient ? (
              <div className="space-y-2" aria-live="polite">
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-muted-foreground">
                  {patientInfo ? (
                    <>
                      <span>
                        {patientInfo.whatsapp || patientInfo.phone
                          ? `${patientInfo.whatsapp ? "WhatsApp" : "Telefone"} ${formatPhone((patientInfo.whatsapp ?? patientInfo.phone)!)}`
                          : "Sem telefone"}
                      </span>
                      <span>{patientInfo.email ?? "sem e-mail"}</span>
                    </>
                  ) : (
                    <span>Carregando dados do paciente…</span>
                  )}
                  <button
                    type="button"
                    onClick={openEdit}
                    disabled={editing?.status === "loading"}
                    className="font-medium text-primary underline-offset-4 hover:underline pointer-coarse:min-h-11"
                  >
                    {editing?.status === "loading" ? "Abrindo cadastro…" : "Editar cadastro"}
                  </button>
                </p>
                {patientInfo && (patientInfo.alerts.length || patientInfo.firstVisit) ? (
                  <ul className="flex flex-wrap gap-1.5" aria-label="Etiquetas do paciente">
                    {patientInfo.alerts.map((a, i) => (
                      <li
                        key={i}
                        className="rounded-full border border-destructive/30 bg-destructive-soft px-2.5 py-0.5 text-xs font-semibold text-destructive"
                      >
                        {alertText(a)}
                      </li>
                    ))}
                    {patientInfo.firstVisit ? (
                      <li className="rounded-full bg-tint-sky px-2.5 py-0.5 text-xs font-semibold text-tint-sky-foreground">Primeira vez</li>
                    ) : null}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </Section>

          <Section title="Procedimentos e horário">
            <AppointmentProcedures value={values.procedures} onChange={setProcedures} catalog={procedures} planItems={patientInfo?.planItems ?? []} />

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="col-span-2 sm:col-span-1">
                <SimpleSelect
                  id="appt-professional"
                  label="Profissional"
                  value={values.professionalId}
                  onChange={(v) => set("professionalId", v)}
                  options={professionals.map((p) => ({
                    value: p.id,
                    label: p.name,
                  }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="appt-date">Data</Label>
                <Input id="appt-date" type="date" required value={values.date} onChange={(e) => e.target.value && set("date", e.target.value)} />
              </div>
              <SimpleSelect
                id="appt-duration"
                label="Duração"
                value={String(values.durationMin)}
                onChange={(v) => set("durationMin", Number(v))}
                options={durations.map((d) => ({
                  value: String(d),
                  label: durationLabel(d),
                }))}
              />
            </div>

            <div ref={slotsRef} className="scroll-mt-4">
              <SlotPicker
                professionalId={values.professionalId}
                professionalName={professionalName}
                date={values.date}
                durationMin={values.durationMin}
                excludeId={values.id ?? null}
                value={values.time}
                onChange={(t) => {
                  set("time", t);
                  setTimeError(undefined);
                }}
                error={timeError}
              />
            </div>

            {chairs.length ? (
              <SimpleSelect
                id="appt-chair"
                label="Cadeira"
                value={values.chairId ?? "none"}
                onChange={(v) => set("chairId", v === "none" ? null : v)}
                options={[{ value: "none", label: "Sem cadeira definida" }, ...chairs.map((c) => ({ value: c.id, label: c.name }))]}
              />
            ) : null}
          </Section>

          <Section title="Detalhes">
            {tags.length ? (
              <div className="space-y-1.5">
                <span className="text-sm font-medium" id="appt-tags">
                  Marcadores
                </span>
                <div className="flex flex-wrap gap-2" role="group" aria-labelledby="appt-tags">
                  {tags.map((t) => {
                    const on = values.tagIds.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => set("tagIds", on ? values.tagIds.filter((x) => x !== t.id) : [...values.tagIds, t.id])}
                        className="inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm pointer-coarse:h-11"
                        style={
                          on
                            ? {
                                backgroundColor: `color-mix(in oklab, ${t.color} 18%, transparent)`,
                                borderColor: t.color,
                              }
                            : undefined
                        }
                      >
                        <span className="size-2.5 rounded-full" style={{ backgroundColor: t.color }} aria-hidden />
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {!values.id ? (
              <div className="space-y-2">
                <span className="text-sm font-medium">Repetir</span>
                <Choice
                  label="Repetir"
                  value={repeat}
                  onChange={setRepeat}
                  options={[
                    { value: "none", label: "Não repetir" },
                    ...(Object.keys(repeatLabels) as Repeat[]).map((r) => ({
                      value: r,
                      label: repeatLabels[r],
                    })),
                  ]}
                />
                {repeat !== "none" ? (
                  <div className="max-w-40 space-y-1.5">
                    <Label htmlFor="appt-repeat-count">Quantas vezes</Label>
                    <Input id="appt-repeat-count" inputMode="numeric" value={repeatCount} onChange={(e) => setRepeatCount(e.target.value)} />
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="appt-type">Descrição (opcional)</Label>
              <Input id="appt-type" placeholder="Ex.: Avaliação, retorno" value={values.type} onChange={(e) => set("type", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appt-notes">Observações</Label>
              <Textarea id="appt-notes" rows={2} value={values.notes} onChange={(e) => set("notes", e.target.value)} />
            </div>
          </Section>

          <Section title="Mensagens desta consulta">
            <p className="text-[0.8125rem] text-muted-foreground">Pelo WhatsApp</p>
            <div className="space-y-2">
              <span className="text-sm font-medium">Pedir confirmação</span>
              <Choice
                label="Pedir confirmação"
                value={values.confirmationMode}
                onChange={(v) => set("confirmationMode", v)}
                options={[
                  { value: "auto", label: "Automático (padrão da clínica)" },
                  { value: "none", label: "Não enviar" },
                  ...(isDentist ? [] : [{ value: "now" as const, label: "Enviar agora" }]),
                ]}
              />
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium">Lembrete na véspera</span>
              <Choice
                label="Lembrete na véspera"
                value={reminderMode}
                onChange={(v) => set("reminderMode", v)}
                disabled={isToday}
                options={[
                  { value: "auto", label: "Automático" },
                  { value: "none", label: "Não enviar" },
                ]}
              />
              {isToday ? <p className="text-[0.8125rem] text-muted-foreground">O lembrete automático não sai para consultas de hoje.</p> : null}
            </div>
          </Section>
        </div>

        <EntryFooter summary={summary}>
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1 sm:flex-none">
            Cancelar
          </Button>
          <Button type="submit" disabled={pending} className="flex-1 sm:flex-none">
            {pending ? "Salvando..." : values.id ? "Salvar alterações" : "Marcar consulta"}
          </Button>
        </EntryFooter>
      </form>

      {/* Fora do <form> da consulta: o envio do cadastro não pode subir até ele. */}
      <Sheet open={editing?.status === "ready"} onOpenChange={(open) => !open && setEditing(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto data-[side=right]:sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle className="type-title">Editar cadastro</SheetTitle>
            <SheetDescription>Ao salvar, você volta para a consulta com tudo o que já preencheu.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            {editing?.status === "ready" ? <PatientForm patient={editing.patient} onSaved={afterPatientSaved} onCancel={() => setEditing(null)} /> : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
