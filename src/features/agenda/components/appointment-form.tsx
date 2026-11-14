"use client";

import { useState, useTransition } from "react";

import { FormMessage } from "@/components/forms/form-message";
import { SimpleSelect } from "@/components/forms/simple-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { saveAppointment, type PatientOption } from "../actions";
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
};

type Props = {
  initial: AppointmentFormValues;
  professionals: { id: string; name: string }[];
  chairs: { id: string; name: string }[];
  procedures: { id: string; name: string; duration_min: number }[];
  onDone: () => void;
  onCancel: () => void;
};

function durationLabel(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

export function AppointmentForm({ initial, professionals, chairs, procedures, onDone, onCancel }: Props) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [patientError, setPatientError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
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
      });
      if (result.error) setError(result.error);
      else onDone();
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
