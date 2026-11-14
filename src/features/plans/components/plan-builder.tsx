"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { cn } from "cn";

import { FormMessage } from "@/components/forms/form-message";
import { SimpleSelect } from "@/components/forms/simple-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/format";
import { centsToInput, parseBRLToCents } from "@/lib/money";

import { ARCHES, conditionColors, conditionLabels, faceLabel, type Face, type ToothCondition } from "@/features/clinical/odontogram";
import { PatientPicker } from "@/features/agenda/components/patient-picker";
import type { PatientOption } from "@/features/agenda/actions";

import { savePlan } from "../actions";

type Procedure = { id: string; name: string; price_cents: number; applies_to_tooth: boolean };
type Item = { key: string; procedureId: string | null; description: string; tooth: number | null; faces: Face[]; priceCents: number };
export type Suggestion = { tooth: number; faces: Face[]; condition: ToothCondition };

type Props = {
  planId?: string;
  patient: PatientOption | null;
  professionalId: string;
  professionals: { id: string; name: string }[];
  procedures: Procedure[];
  suggestions: Suggestion[];
  initialItems: Omit<Item, "key">[];
  initialNotes: string;
  initialValidUntil: string | null;
};

const ALL_TEETH = Object.values(ARCHES).flat().sort((a, b) => a - b);
const FACE_ORDER: Face[] = ["M", "O", "D", "V", "L"];
let counter = 0;
const key = () => `i${++counter}`;

export function PlanBuilder(props: Props) {
  const router = useRouter();
  const [patient, setPatient] = useState(props.patient);
  const [professionalId, setProfessionalId] = useState(props.professionalId);
  const [items, setItems] = useState<Item[]>(() => props.initialItems.map((i) => ({ ...i, key: key() })));
  const [notes, setNotes] = useState(props.initialNotes);
  const [validUntil, setValidUntil] = useState(props.initialValidUntil ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Formulário de inclusão
  const [procedureId, setProcedureId] = useState(props.procedures[0]?.id ?? "");
  const [tooth, setTooth] = useState<number | null>(null);
  const [faces, setFaces] = useState<Face[]>([]);
  const [price, setPrice] = useState(props.procedures[0] ? centsToInput(props.procedures[0].price_cents) : "0,00");
  const procedure = props.procedures.find((p) => p.id === procedureId);
  const total = useMemo(() => items.reduce((s, i) => s + i.priceCents, 0), [items]);

  function chooseProcedure(id: string) {
    setProcedureId(id);
    const p = props.procedures.find((x) => x.id === id);
    if (p) setPrice(centsToInput(p.price_cents));
    if (p && !p.applies_to_tooth) {
      setTooth(null);
      setFaces([]);
    }
  }

  function addItem() {
    if (!procedure) return;
    const cents = parseBRLToCents(price);
    if (cents === null) {
      setError("Valor inválido. Ex.: 150,00");
      return;
    }
    if (procedure.applies_to_tooth && tooth === null) {
      setError("Escolha o dente para este procedimento.");
      return;
    }
    setError(null);
    setItems((list) => [
      ...list,
      { key: key(), procedureId: procedure.id, description: procedure.name, tooth: procedure.applies_to_tooth ? tooth : null, faces: procedure.applies_to_tooth ? faces : [], priceCents: cents },
    ]);
    setFaces([]);
  }

  function applySuggestion(s: Suggestion) {
    setTooth(s.tooth);
    setFaces(s.faces);
    const firstToothProcedure = procedure?.applies_to_tooth ? procedure : props.procedures.find((p) => p.applies_to_tooth);
    if (firstToothProcedure && firstToothProcedure.id !== procedureId) chooseProcedure(firstToothProcedure.id);
  }

  function submit() {
    if (!patient) {
      setError("Escolha o paciente.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await savePlan({
        id: props.planId,
        patientId: patient.id,
        professionalId,
        notes,
        validUntil: validUntil || null,
        items: items.map(({ procedureId: pid, description, tooth: t, faces: f, priceCents }) => ({ procedureId: pid, description, tooth: t, faces: f, priceCents })),
      });
      if (result.error) setError(result.error);
      else router.push(`/orcamentos/${result.id}`);
    });
  }

  return (
    <div className="space-y-6">
      {error ? <FormMessage state={{ status: "error", message: error }} /> : null}

      <section className="grid gap-4 rounded-xl border p-5 sm:grid-cols-2 sm:p-6" aria-label="Paciente e profissional">
        {props.planId ? (
          <div className="space-y-1.5">
            <Label>Paciente</Label>
            <p className="rounded-lg border bg-muted/30 px-3 py-2 text-sm font-medium">{patient?.name}</p>
          </div>
        ) : (
          <PatientPicker value={patient} onChange={setPatient} />
        )}
        <SimpleSelect
          id="plan-professional"
          label="Profissional"
          value={professionalId}
          onChange={setProfessionalId}
          options={props.professionals.map((p) => ({ value: p.id, label: p.name }))}
        />
      </section>

      <section className="space-y-4 rounded-xl border p-5 sm:p-6" aria-labelledby="incluir-item">
        <h2 id="incluir-item" className="text-base font-medium">
          Incluir procedimento
        </h2>

        {props.suggestions.length ? (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Sparkles className="size-4" aria-hidden />
              Do odontograma
            </p>
            <div className="flex flex-wrap gap-2">
              {props.suggestions.map((s) => (
                <button
                  key={`${s.tooth}-${s.condition}-${s.faces.join("")}`}
                  type="button"
                  onClick={() => applySuggestion(s)}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm hover:bg-muted pointer-coarse:h-11",
                    tooth === s.tooth && "border-primary bg-primary/10",
                  )}
                >
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: conditionColors[s.condition] }} aria-hidden />
                  {s.tooth} · {conditionLabels[s.condition]}
                  {s.faces.length ? ` (${s.faces.join(", ")})` : ""}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
          <SimpleSelect
            id="plan-procedure"
            label="Procedimento"
            value={procedureId}
            onChange={chooseProcedure}
            options={props.procedures.map((p) => ({ value: p.id, label: p.name }))}
          />
          <div className="space-y-1.5">
            <Label htmlFor="plan-price">Valor (R$)</Label>
            <Input id="plan-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
        </div>

        {procedure?.applies_to_tooth ? (
          <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
            <SimpleSelect
              id="plan-tooth"
              label="Dente"
              value={tooth ? String(tooth) : "none"}
              onChange={(v) => setTooth(v === "none" ? null : Number(v))}
              options={[{ value: "none", label: "Escolha" }, ...ALL_TEETH.map((t) => ({ value: String(t), label: String(t) }))]}
            />
            <div className="space-y-1.5">
              <span className="text-sm font-medium" id="plan-faces">
                Faces (opcional)
              </span>
              <div className="flex flex-wrap gap-2" role="group" aria-labelledby="plan-faces">
                {FACE_ORDER.map((f) => (
                  <button
                    key={f}
                    type="button"
                    disabled={!tooth}
                    aria-pressed={faces.includes(f)}
                    onClick={() => setFaces((list) => (list.includes(f) ? list.filter((x) => x !== f) : [...list, f]))}
                    className={cn(
                      "h-9 rounded-lg border px-3 text-sm transition-colors disabled:opacity-50 pointer-coarse:h-11",
                      faces.includes(f) ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                    )}
                  >
                    {tooth ? faceLabel(f, tooth) : f}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <Button type="button" variant="outline" onClick={addItem} disabled={!procedure}>
          <Plus aria-hidden />
          Incluir no orçamento
        </Button>
      </section>

      <section className="space-y-2" aria-labelledby="itens-orcamento">
        <h2 id="itens-orcamento" className="text-base font-medium">
          Itens
        </h2>
        {items.length ? (
          <ul className="divide-y rounded-xl border">
            {items.map((item) => (
              <li key={item.key} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{item.description}</p>
                  {item.tooth ? (
                    <p className="text-sm text-muted-foreground">
                      Dente {item.tooth}
                      {item.faces.length ? ` · ${item.faces.map((f) => faceLabel(f, item.tooth!)).join(", ")}` : ""}
                    </p>
                  ) : null}
                </div>
                <Input
                  aria-label={`Valor de ${item.description}`}
                  inputMode="decimal"
                  defaultValue={centsToInput(item.priceCents)}
                  onBlur={(e) => {
                    const cents = parseBRLToCents(e.target.value);
                    if (cents !== null) setItems((list) => list.map((i) => (i.key === item.key ? { ...i, priceCents: cents } : i)));
                    else e.target.value = centsToInput(item.priceCents);
                  }}
                  className="w-28 text-right tabular-nums"
                />
                <Button type="button" variant="ghost" size="icon" aria-label={`Remover ${item.description}`} onClick={() => setItems((list) => list.filter((i) => i.key !== item.key))}>
                  <Trash2 />
                </Button>
              </li>
            ))}
            <li className="flex items-center justify-between px-4 py-3 text-sm font-medium sm:px-5">
              <span>Total</span>
              <span className="tabular-nums">{formatCurrency(total)}</span>
            </li>
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed px-6 py-8 text-center text-sm text-muted-foreground">Nenhum item ainda.</p>
        )}
      </section>

      <section className="grid gap-4 rounded-xl border p-5 sm:grid-cols-[12rem_1fr] sm:p-6" aria-label="Observações">
        <div className="space-y-1.5">
          <Label htmlFor="plan-valid">Válido até</Label>
          <Input id="plan-valid" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="plan-notes">Observações</Label>
          <Textarea id="plan-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </section>

      <div className="flex justify-end">
        <Button type="button" onClick={submit} disabled={pending || !items.length}>
          {pending ? "Salvando..." : props.planId ? "Salvar alterações" : "Criar orçamento"}
        </Button>
      </div>
    </div>
  );
}
