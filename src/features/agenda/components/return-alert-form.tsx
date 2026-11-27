"use client";

import { useState, useTransition } from "react";

import { FormMessage } from "@/components/forms/form-message";
import { SimpleSelect } from "@/components/forms/simple-select";
import { Button } from "@/components/ui/button";
import { DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createReturn, type PatientOption } from "../actions";

import { PatientPicker } from "./patient-picker";

type Props = {
  professionals: { id: string; name: string }[];
  onDone: (message?: string) => void;
  onCancel: () => void;
  /** Paciente já escolhido (aberto pela ficha). */
  initialPatient?: PatientOption | null;
};

/** Alerta de retorno avulso (o mesmo que aparece ao concluir a consulta), com busca do paciente. */
export function ReturnAlertForm({ professionals, onDone, onCancel, initialPatient = null }: Props) {
  const [patient, setPatient] = useState<PatientOption | null>(initialPatient);
  const [patientError, setPatientError] = useState<string | undefined>();
  const [months, setMonths] = useState("6");
  const [reason, setReason] = useState("Retorno");
  const [professionalId, setProfessionalId] = useState("none");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!patient) return setPatientError("Escolha o paciente.");
    const n = Number(months);
    if (!Number.isInteger(n) || n < 1 || n > 60) return setError("Meses entre 1 e 60.");
    if (reason.trim().length < 2) return setError("Escreva o motivo do retorno.");
    setError(null);
    startTransition(async () => {
      const r = await createReturn({ patientId: patient.id, months: n, reason: reason.trim(), professionalId: professionalId === "none" ? null : professionalId, procedureId: null, sourceAppointmentId: null });
      if (r.error) setError(r.error);
      else onDone(`Alerta de retorno criado para ${patient.name}.`);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <DialogHeader>
        <DialogTitle className="type-title">Alerta de retorno</DialogTitle>
        <DialogDescription>O paciente entra na lista de retornos e recebe o lembrete quando chegar a hora.</DialogDescription>
      </DialogHeader>
      {error ? <FormMessage state={{ status: "error", message: error }} /> : null}
      <PatientPicker
        value={patient}
        onChange={(p) => {
          setPatient(p);
          setPatientError(undefined);
        }}
        error={patientError}
      />
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="return-alert-months">Retorno em (meses)</Label>
          <Input id="return-alert-months" inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value)} />
        </div>
        <SimpleSelect
          id="return-alert-professional"
          label="Profissional"
          value={professionalId}
          onChange={setProfessionalId}
          options={[{ value: "none", label: "Qualquer um" }, ...professionals.map((p) => ({ value: p.id, label: p.name }))]}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="return-alert-reason">Motivo</Label>
        <Input id="return-alert-reason" maxLength={160} value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Criar alerta"}
        </Button>
      </DialogFooter>
    </form>
  );
}
