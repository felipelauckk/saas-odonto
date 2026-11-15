"use client";

import { useState, useTransition } from "react";

import { FormMessage } from "@/components/forms/form-message";
import { SimpleSelect } from "@/components/forms/simple-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { saveAppointment, type PatientOption } from "../actions";
import { repeatLabels, type Repeat } from "../advanced";
import { DURATION_OPTIONS } from "../labels";
import { PatientPicker } from "./patient-picker";

export type AppointmentFormValues = {
  id?: string;
  patient: PatientOption | null;
  professionalId: string;
  chairId: string | null;
  procedureId: string | null;
  date: string;
  time: string;
  durationMin: number;
  type: string;
  notes: string;
  tagIds: string[];
};

type Props = {
  initial: AppointmentFormValues;
  professionals: { id: string; name: string }[];
  chairs: { id: string; name: string }[];
  procedures: { id: string; name: string; duration_min: number }[];
  tags: { id: string; name: string; color: string }[];
  onDone: (message?: string) => void;
  onCancel: () => void;
};

function durationLabel(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

export function AppointmentForm({ initial, professionals, chairs, procedures, tags, onDone, onCancel }: Props) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [patientError, setPatientError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const [repeat, setRepeat] = useState<"none" | Repeat>("none");
  const [repeatCount, setRepeatCount] = useState("4");
  const set = <K extends keyof AppointmentFormValues>(key: K, value: AppointmentFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const durations = [...new Set([...DURATION_OPTIONS, values.durationMin])].sort((a, b) => a - b);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.patient) {
      setPatientError("Escolha o paciente.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await saveAppointment({
        id: values.id,
        patientId: values.patient!.id,
        professionalId: values.professionalId,
        chairId: values.chairId ?? "",
        procedureId: values.procedureId ?? "",
        date: values.date,
        time: values.time,
        durationMin: values.durationMin,
        type: values.type,
        notes: values.notes,
        tagIds: values.tagIds,
        repeat: repeat === "none" ? null : repeat,
        repeatCount: repeat === "none" ? undefined : Number(repeatCount),
      });
      if (result.error) setError(result.failed?.length ? `${result.error} Nenhuma data da série foi marcada.` : result.error);
      else if (result.failed?.length) {
        onDone(`${result.created} consultas marcadas. Não deu para marcar: ${result.failed.map((f) => `${f.date.split("-").reverse().join("/")} (${f.reason})`).join("; ")}`);
      } else onDone(result.created && result.created > 1 ? `${result.created} consultas marcadas.` : undefined);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error ? <FormMessage state={{ status: "error", message: error }} /> : null}

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
          }}
          error={patientError}
        />
      )}

      <SimpleSelect
        id="appt-professional"
        label="Profissional"
        value={values.professionalId}
        onChange={(v) => set("professionalId", v)}
        options={professionals.map((p) => ({ value: p.id, label: p.name }))}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="appt-date">Data</Label>
          <Input id="appt-date" type="date" required value={values.date} onChange={(e) => set("date", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="appt-time">Início</Label>
          <Input id="appt-time" type="time" step={300} required value={values.time} onChange={(e) => set("time", e.target.value)} />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <SimpleSelect
            id="appt-duration"
            label="Duração"
            value={String(values.durationMin)}
            onChange={(v) => set("durationMin", Number(v))}
            options={durations.map((d) => ({ value: String(d), label: durationLabel(d) }))}
          />
        </div>
      </div>

      {procedures.length ? (
        <SimpleSelect
          id="appt-procedure"
          label="Procedimento (opcional)"
          value={values.procedureId ?? "none"}
          onChange={(v) => {
            const procedure = procedures.find((p) => p.id === v);
            setValues((current) => ({
              ...current,
              procedureId: procedure ? procedure.id : null,
              durationMin: procedure ? procedure.duration_min : current.durationMin,
              type: procedure ? procedure.name : current.type,
            }));
          }}
          options={[{ value: "none", label: "Nenhum" }, ...procedures.map((p) => ({ value: p.id, label: p.name }))]}
        />
      ) : null}

      {chairs.length ? (
        <SimpleSelect
          id="appt-chair"
          label="Cadeira"
          value={values.chairId ?? "none"}
          onChange={(v) => set("chairId", v === "none" ? null : v)}
          options={[{ value: "none", label: "Sem cadeira definida" }, ...chairs.map((c) => ({ value: c.id, label: c.name }))]}
        />
      ) : null}

      {tags.length ? (
        <div className="space-y-1.5">
          <span className="text-sm font-medium" id="appt-tags">Marcadores</span>
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
                  style={on ? { backgroundColor: `color-mix(in oklab, ${t.color} 18%, transparent)`, borderColor: t.color } : undefined}
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
        <div className="grid grid-cols-2 gap-4">
          <SimpleSelect
            id="appt-repeat"
            label="Repetir"
            value={repeat}
            onChange={(v) => setRepeat(v as "none" | Repeat)}
            options={[{ value: "none", label: "Não repetir" }, ...(Object.keys(repeatLabels) as Repeat[]).map((r) => ({ value: r, label: repeatLabels[r] }))]}
          />
          {repeat !== "none" ? (
            <div className="space-y-1.5">
              <Label htmlFor="appt-repeat-count">Quantas consultas</Label>
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

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : values.id ? "Salvar alterações" : "Marcar consulta"}
        </Button>
      </div>
    </form>
  );
}
