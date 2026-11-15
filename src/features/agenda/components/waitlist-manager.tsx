"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";

import { FormMessage } from "@/components/forms/form-message";
import { SimpleSelect } from "@/components/forms/simple-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format";

import { PatientPicker } from "./patient-picker";
import type { PatientOption } from "../actions";
import { addToWaitlist, removeFromWaitlist } from "../actions";
import { periodLabels, type Period } from "../advanced";

type Entry = { id: string; created_at: string; period: Period; notes: string | null; patients: { full_name: string } | null; professionals: { name: string } | null };

export function WaitlistManager({ entries, professionals }: { entries: Entry[]; professionals: { id: string; name: string }[] }) {
  const [patient, setPatient] = useState<PatientOption | null>(null);
  const [professionalId, setProfessionalId] = useState("none");
  const [period, setPeriod] = useState<Period>("any");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-xl border p-5" aria-label="Incluir na lista de espera">
        {error ? <FormMessage state={{ status: "error", message: error }} /> : null}
        <PatientPicker value={patient} onChange={setPatient} />
        <div className="grid gap-4 sm:grid-cols-2">
          <SimpleSelect id="wait-pro" label="Profissional" value={professionalId} onChange={setProfessionalId} options={[{ value: "none", label: "Qualquer um" }, ...professionals.map((p) => ({ value: p.id, label: p.name }))]} />
          <SimpleSelect id="wait-period" label="Período" value={period} onChange={(v) => setPeriod(v as Period)} options={(Object.keys(periodLabels) as Period[]).map((p) => ({ value: p, label: periodLabels[p] }))} />
        </div>
        <Input aria-label="Observação" placeholder="Observação (ex.: só às terças)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Button disabled={pending || !patient} onClick={() => startTransition(async () => {
          const r = await addToWaitlist({ patientId: patient!.id, professionalId: professionalId === "none" ? null : professionalId, period, notes });
          if (r.error) setError(r.error);
          else { setPatient(null); setNotes(""); setError(null); }
        })}>
          <Plus aria-hidden />
          Incluir na lista
        </Button>
      </section>
      {entries.length ? (
        <ul className="divide-y rounded-xl border">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-4 py-3 text-sm sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{e.patients?.full_name}</p>
                <p className="text-muted-foreground">
                  {e.professionals?.name ?? "Qualquer profissional"} · {periodLabels[e.period]} · desde {formatDate(e.created_at)}
                  {e.notes ? ` · ${e.notes}` : ""}
                </p>
              </div>
              <Button variant="ghost" size="sm" disabled={pending} onClick={() => startTransition(async () => { await removeFromWaitlist(e.id); })}>Tirar da lista</Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Ninguém na lista de espera. Quando uma consulta é desmarcada, o sistema sugere quem da lista cabe no horário.</p>
      )}
    </div>
  );
}
