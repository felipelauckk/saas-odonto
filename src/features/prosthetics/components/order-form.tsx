"use client";

import { useEffect, useState, useTransition } from "react";
import { cn } from "cn";

import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PatientOption } from "@/features/agenda/actions";
import { PatientPicker } from "@/features/agenda/components/patient-picker";
import { centsToInput } from "@/lib/money";
import { addDays } from "@/lib/timezone";

import { patientPlanItems, saveOrder } from "../actions";
import { kindLabels, type ProstheticKind } from "../labels";
import type { ProstheticOrder } from "../queries";

export type OrderOptions = {
  labs: { id: string; name: string; active: boolean }[];
  services: { id: string; lab_id: string; name: string; price_cents: number; days: number | null; active: boolean }[];
  professionals: { id: string; name: string }[];
};

const select = "h-9 w-full rounded-lg border bg-background px-2.5 text-sm pointer-coarse:h-11";

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

export function OrderForm({ order, options, today, onDone }: { order?: ProstheticOrder; options: OrderOptions; today: string; onDone: () => void }) {
  const [patient, setPatient] = useState<PatientOption | null>(order ? { id: order.patientId, name: order.patientName, detail: order.patientPhone } : null);
  const [kind, setKind] = useState<ProstheticKind>(order?.kind ?? "prosthesis");
  const [workType, setWorkType] = useState(order?.workType ?? "");
  const [teeth, setTeeth] = useState(order?.teeth.join(", ") ?? "");
  const [shade, setShade] = useState(order?.shade ?? "");
  const [material, setMaterial] = useState(order?.material ?? "");
  const [professionalId, setProfessionalId] = useState(order?.professionalId ?? "");
  const [labId, setLabId] = useState(order?.labId ?? "");
  const [serviceId, setServiceId] = useState(order?.labServiceId ?? "");
  const [planItemId, setPlanItemId] = useState(order?.planItemId ?? "");
  const [items, setItems] = useState<{ id: string; label: string }[]>([]);
  const [sentOn, setSentOn] = useState(order?.sentOn ?? "");
  const [expected, setExpected] = useState(order?.expectedReturnOn ?? "");
  const [cost, setCost] = useState(order ? centsToInput(order.costCents) : "");
  const [alignerTotal, setAlignerTotal] = useState(order?.alignerTotal ? String(order.alignerTotal) : "");
  const [alignerDays, setAlignerDays] = useState(order?.alignerChangeDays ? String(order.alignerChangeDays) : "14");
  const [notes, setNotes] = useState(order?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!patient) return;
    let alive = true;
    patientPlanItems(patient.id).then((list) => alive && setItems(list));
    return () => {
      alive = false;
    };
  }, [patient]);

  function pickService(id: string) {
    setServiceId(id);
    const s = options.services.find((x) => x.id === id);
    if (!s) return;
    if (!workType) setWorkType(s.name);
    setCost(centsToInput(s.price_cents));
    if (s.days !== null) setExpected(addDays(sentOn || today, s.days));
  }

  function submit() {
    if (!patient) return setError("Escolha o paciente.");
    const teethList = teeth
      .split(/[\s,;]+/)
      .filter(Boolean)
      .map(Number);
    if (teethList.some((t) => !Number.isInteger(t) || t < 11 || t > 85)) return setError("Dentes inválidos. Ex.: 11, 21");
    startTransition(async () => {
      const r = await saveOrder({
        id: order?.id,
        patientId: patient.id,
        professionalId: professionalId || null,
        planItemId: planItemId || null,
        labId: labId || null,
        labServiceId: serviceId || null,
        kind,
        workType,
        teeth: teethList,
        shade: shade || null,
        material: material || null,
        sentOn: sentOn || null,
        expectedReturnOn: expected || null,
        cost,
        alignerTotal: kind === "aligner" && alignerTotal ? Number(alignerTotal) : null,
        alignerChangeDays: kind === "aligner" && alignerDays ? Number(alignerDays) : null,
        alignerStartedOn: order?.alignerStartedOn ?? null,
        notes: notes || null,
      });
      if (r.error) setError(r.error);
      else onDone();
    });
  }

  const labServices = options.services.filter((s) => s.lab_id === labId && (s.active || s.id === serviceId));

  return (
    <div className="space-y-4">
      {error ? <FormMessage state={{ status: "error", message: error }} /> : null}
      {order ? <p className="text-sm font-medium">{order.patientName}</p> : <PatientPicker value={patient} onChange={setPatient} />}
      {!order ? (
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Tipo">
          {(["prosthesis", "aligner"] as const).map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}
              className={cn("h-9 rounded-lg border text-sm font-medium pointer-coarse:h-11", kind === k ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>
              {kindLabels[k]}
            </button>
          ))}
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="po-lab" label="Laboratório">
          <select id="po-lab" className={select} value={labId} onChange={(e) => { setLabId(e.target.value); setServiceId(""); }}>
            <option value="">Sem laboratório</option>
            {options.labs.filter((l) => l.active || l.id === labId).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </Field>
        <Field id="po-service" label="Serviço (tabela do laboratório)">
          <select id="po-service" className={select} value={serviceId} onChange={(e) => pickService(e.target.value)} disabled={!labServices.length}>
            <option value="">{labServices.length ? "Escolha" : "Nenhum cadastrado"}</option>
            {labServices.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field id="po-work" label="Tipo de trabalho">
          <Input id="po-work" value={workType} maxLength={120} onChange={(e) => setWorkType(e.target.value)} placeholder={kind === "aligner" ? "Ex.: Alinhadores superiores e inferiores" : "Ex.: Coroa de zircônia"} />
        </Field>
        <Field id="po-teeth" label="Dentes">
          <Input id="po-teeth" value={teeth} onChange={(e) => setTeeth(e.target.value)} placeholder="Ex.: 11, 21" />
        </Field>
        {kind === "prosthesis" ? (
          <>
            <Field id="po-shade" label="Cor"><Input id="po-shade" value={shade} maxLength={40} onChange={(e) => setShade(e.target.value)} placeholder="Ex.: A2" /></Field>
            <Field id="po-material" label="Material"><Input id="po-material" value={material} maxLength={80} onChange={(e) => setMaterial(e.target.value)} /></Field>
          </>
        ) : (
          <>
            <Field id="po-aligners" label="Número de placas"><Input id="po-aligners" inputMode="numeric" value={alignerTotal} onChange={(e) => setAlignerTotal(e.target.value)} /></Field>
            <Field id="po-change" label="Troca a cada (dias)"><Input id="po-change" inputMode="numeric" value={alignerDays} onChange={(e) => setAlignerDays(e.target.value)} /></Field>
          </>
        )}
        <Field id="po-sent" label="Envio ao laboratório"><Input id="po-sent" type="date" value={sentOn} onChange={(e) => setSentOn(e.target.value)} /></Field>
        <Field id="po-expected" label="Retorno previsto"><Input id="po-expected" type="date" value={expected} onChange={(e) => setExpected(e.target.value)} /></Field>
        <Field id="po-cost" label="Custo (R$)"><Input id="po-cost" inputMode="decimal" placeholder="0,00" value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
        <Field id="po-pro" label="Profissional">
          <select id="po-pro" className={select} value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
            <option value="">Não informado</option>
            {options.professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
      </div>
      <Field id="po-item" label="Item do orçamento (o custo entra como laboratório na comissão)">
        <select id="po-item" className={select} value={planItemId} onChange={(e) => setPlanItemId(e.target.value)}>
          <option value="">Nenhum</option>
          {order?.planItemId && !items.some((i) => i.id === order.planItemId) ? <option value={order.planItemId}>{order.planItemLabel}</option> : null}
          {items.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
        </select>
      </Field>
      <Field id="po-notes" label="Observações"><Textarea id="po-notes" value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} /></Field>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>Cancelar</Button>
        <Button disabled={pending} onClick={submit}>{order ? "Salvar" : "Criar ordem"}</Button>
      </div>
    </div>
  );
}
