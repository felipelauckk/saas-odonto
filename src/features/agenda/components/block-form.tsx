"use client";

import { useState, useTransition } from "react";

import { FormMessage } from "@/components/forms/form-message";
import { SimpleSelect } from "@/components/forms/simple-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createBlock } from "../actions";

type Props = {
  date: string;
  professionals: { id: string; name: string }[];
  /** Dentista só bloqueia a própria agenda. */
  allowUnitWide: boolean;
  onDone: () => void;
  onCancel: () => void;
};

export function BlockForm({ date: initialDate, professionals, allowUnitWide, onDone, onCancel }: Props) {
  const [professionalId, setProfessionalId] = useState(allowUnitWide ? "none" : (professionals[0]?.id ?? "none"));
  const [date, setDate] = useState(initialDate);
  const [allDay, setAllDay] = useState(false);
  const [startTime, setStartTime] = useState("12:00");
  const [endTime, setEndTime] = useState("13:00");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createBlock({ professionalId, date, allDay, startTime, endTime, reason });
      if (result.error) setError(result.error);
      else onDone();
    });
  }

  const options = [
    ...(allowUnitWide ? [{ value: "none", label: "Unidade toda (todos os profissionais)" }] : []),
    ...professionals.map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error ? <FormMessage state={{ status: "error", message: error }} /> : null}
      <SimpleSelect id="block-professional" label="Agenda" value={professionalId} onChange={setProfessionalId} options={options} />
      <div className="space-y-1.5">
        <Label htmlFor="block-date">Data</Label>
        <Input id="block-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <Label className="flex items-center gap-3 font-normal pointer-coarse:min-h-11">
        <Checkbox checked={allDay} onCheckedChange={(c) => setAllDay(c === true)} />
        Dia inteiro
      </Label>
      {!allDay ? (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="block-start">Das</Label>
            <Input id="block-start" type="time" step={300} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="block-end">Até</Label>
            <Input id="block-end" type="time" step={300} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
        </div>
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor="block-reason">Motivo (opcional)</Label>
        <Input id="block-reason" placeholder="Ex.: almoço, curso, feriado" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Bloqueando..." : "Bloquear horário"}
        </Button>
      </div>
    </form>
  );
}
