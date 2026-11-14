"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";

import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { todayIso } from "@/lib/dates";
import { parseBRLToCents } from "@/lib/money";

import { PatientPicker } from "@/features/agenda/components/patient-picker";
import type { PatientOption } from "@/features/agenda/actions";

import { createReceivable } from "../actions";

export function NewReceivableButton({ patient: fixedPatient }: { patient?: PatientOption }) {
  const [open, setOpen] = useState(false);
  const [patient, setPatient] = useState<PatientOption | null>(fixedPatient ?? null);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(todayIso());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    const cents = parseBRLToCents(amount);
    if (!patient) return setError("Escolha o paciente.");
    if (!cents) return setError("Valor inválido.");
    startTransition(async () => {
      const result = await createReceivable({ patientId: patient.id, description, amountCents: cents, dueDate });
      if (result.error) setError(result.error);
      else {
        setOpen(false);
        setDescription("");
        setAmount("");
        if (!fixedPatient) setPatient(null);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); setError(null); }}>
      <DialogTrigger render={<Button variant="outline" />}>
        <Plus aria-hidden />
        Nova cobrança
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova cobrança</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {error ? <FormMessage state={{ status: "error", message: error }} /> : null}
          {fixedPatient ? null : <PatientPicker value={patient} onChange={setPatient} />}
          <div className="space-y-1.5">
            <Label htmlFor="new-receivable-description">Descrição</Label>
            <Input id="new-receivable-description" placeholder="Ex.: consulta de urgência" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-receivable-amount">Valor (R$)</Label>
              <Input id="new-receivable-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-receivable-due">Vencimento</Label>
              <Input id="new-receivable-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={submit} disabled={pending}>
              {pending ? "Salvando..." : "Criar cobrança"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
