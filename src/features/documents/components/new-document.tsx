"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Search, Trash2 } from "lucide-react";

import { FormMessage } from "@/components/forms/form-message";
import { SimpleSelect } from "@/components/forms/simple-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { issueDocument, previewDocument } from "../actions";
import { CLINICAL_KINDS, documentKindLabels, PRESCRIPTION_KINDS, type DocumentKind } from "../labels";
import type { PrescriptionItem } from "../variables";

type Template = { id: string; kind: DocumentKind; name: string; procedure_id: string | null };
type Option = { id: string; name: string };
type Medication = { id: string; name: string; presentation: string | null; default_dosage: string | null; default_quantity: string | null; special_control: boolean };

type Props = {
  patientId: string;
  templates: Template[];
  ownProfessionals: Option[];
  allProfessionals: Option[];
  procedures: Option[];
  plans: Option[];
  medications: Medication[];
  initialKind?: DocumentKind | null;
  initialPlanId?: string | null;
};

function normalize(v: string) {
  return v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function NewDocumentButton(props: Props) {
  const initialTemplate = props.templates.find((t) => t.kind === props.initialKind) ?? props.templates[0];
  const [open, setOpen] = useState(Boolean(props.initialKind && initialTemplate));
  const [templateId, setTemplateId] = useState(initialTemplate?.id ?? "");
  const template = props.templates.find((t) => t.id === templateId);
  const clinical = template ? CLINICAL_KINDS.includes(template.kind) : false;
  const isPrescription = template ? PRESCRIPTION_KINDS.includes(template.kind) : false;
  const professionals = clinical ? props.ownProfessionals : props.allProfessionals;

  const [professionalId, setProfessionalId] = useState(props.ownProfessionals[0]?.id ?? props.allProfessionals[0]?.id ?? "none");
  const [planId, setPlanId] = useState(props.initialPlanId ?? "none");
  const [procedureId, setProcedureId] = useState(template?.procedure_id ?? "none");
  const [dias, setDias] = useState("1");
  const [cid, setCid] = useState("");
  const [items, setItems] = useState<PrescriptionItem[]>([]);
  const [medQuery, setMedQuery] = useState("");
  const [draft, setDraft] = useState<{ title: string; body: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const medResults = useMemo(() => {
    const q = normalize(medQuery.trim());
    if (q.length < 2) return [];
    return props.medications.filter((m) => normalize(`${m.name} ${m.presentation ?? ""}`).includes(q)).slice(0, 8);
  }, [medQuery, props.medications]);

  const specialNeeded = template?.kind === "prescription" && items.some((i) => props.medications.find((m) => m.name === i.name && m.special_control));

  function reset() {
    setDraft(null);
    setError(null);
  }

  function makePreview() {
    if (!template) return;
    if (clinical && professionalId === "none") return setError("Seu usuário precisa estar ligado a um profissional para emitir este documento.");
    if (isPrescription && !items.length) return setError("Inclua pelo menos um medicamento.");
    setError(null);
    startTransition(async () => {
      const r = await previewDocument({
        patientId: props.patientId,
        templateId: template.id,
        professionalId: professionalId === "none" ? null : professionalId,
        planId: planId === "none" ? null : planId,
        procedureId: procedureId === "none" ? null : procedureId,
        dias,
        cid,
        prescription: isPrescription ? items : null,
      });
      if (r.error) setError(r.error);
      else setDraft({ title: r.title!, body: r.body! });
    });
  }

  function issue() {
    if (!template || !draft) return;
    startTransition(async () => {
      const r = await issueDocument({
        patientId: props.patientId,
        templateId: template.id,
        kind: template.kind,
        title: draft.title,
        body: draft.body,
        professionalId: professionalId === "none" ? null : professionalId,
        planId: planId === "none" ? null : planId,
        prescription: isPrescription ? items : null,
      });
      if (r.error) setError(r.error);
      else {
        setOpen(false);
        setDraft(null);
        setItems([]);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger render={<Button />}>
        <Plus aria-hidden />
        Novo documento
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{draft ? "Revise antes de emitir" : "Novo documento"}</DialogTitle>
        </DialogHeader>
        {error ? <FormMessage state={{ status: "error", message: error }} /> : null}

        {draft ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="doc-title">Título</Label>
              <Input id="doc-title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-body">Texto</Label>
              <Textarea id="doc-body" rows={14} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} className="font-mono text-sm" />
              <p className="text-xs text-muted-foreground">Depois de emitido, o documento não pode ser editado (só cancelado).</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDraft(null)}>
                Voltar
              </Button>
              <Button onClick={issue} disabled={pending}>
                {pending ? "Emitindo..." : "Emitir documento"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <SimpleSelect
              id="doc-template"
              label="Modelo"
              value={templateId}
              onChange={(v) => {
                setTemplateId(v);
                const t = props.templates.find((x) => x.id === v);
                setProcedureId(t?.procedure_id ?? "none");
              }}
              options={props.templates.map((t) => ({ value: t.id, label: `${documentKindLabels[t.kind]} · ${t.name}` }))}
            />
            {professionals.length ? (
              <SimpleSelect
                id="doc-professional"
                label="Profissional"
                value={professionals.some((p) => p.id === professionalId) ? professionalId : (professionals[0]?.id ?? "none")}
                onChange={setProfessionalId}
                options={[...(clinical ? [] : [{ value: "none", label: "Nenhum" }]), ...professionals.map((p) => ({ value: p.id, label: p.name }))]}
              />
            ) : clinical ? (
              <p className="text-sm text-destructive">Seu usuário não está ligado a um profissional, então não pode emitir {documentKindLabels[template!.kind].toLowerCase()}.</p>
            ) : null}

            {template?.kind === "certificate" ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="doc-dias">Dias de afastamento</Label>
                  <Input id="doc-dias" inputMode="numeric" value={dias} onChange={(e) => setDias(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="doc-cid">CID (opcional)</Label>
                  <Input id="doc-cid" value={cid} onChange={(e) => setCid(e.target.value)} />
                </div>
              </div>
            ) : null}

            {template && (template.kind === "contract" || template.kind === "consent") && props.plans.length ? (
              <SimpleSelect
                id="doc-plan"
                label="Orçamento"
                value={planId}
                onChange={setPlanId}
                options={[{ value: "none", label: "Nenhum" }, ...props.plans.map((p) => ({ value: p.id, label: p.name }))]}
              />
            ) : null}

            {template?.kind === "consent" ? (
              <SimpleSelect
                id="doc-procedure"
                label="Procedimento"
                value={procedureId}
                onChange={setProcedureId}
                options={[{ value: "none", label: "Escolha" }, ...props.procedures.map((p) => ({ value: p.id, label: p.name }))]}
              />
            ) : null}

            {isPrescription ? (
              <section className="space-y-3 rounded-lg border p-4" aria-label="Medicamentos">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input aria-label="Buscar medicamento" placeholder="Buscar medicamento" value={medQuery} onChange={(e) => setMedQuery(e.target.value)} className="pl-8" />
                </div>
                {medResults.length ? (
                  <ul className="divide-y rounded-lg border">
                    {medResults.map((m) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted pointer-coarse:min-h-11"
                          onClick={() => {
                            setItems((list) => [...list, { name: m.name, presentation: m.presentation, dosage: m.default_dosage ?? "", quantity: m.default_quantity }]);
                            setMedQuery("");
                          }}
                        >
                          <span>
                            {m.name} <span className="text-muted-foreground">{m.presentation}</span>
                          </span>
                          {m.special_control ? <Badge variant="outline">Controle especial</Badge> : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {items.map((item, i) => (
                  <div key={i} className="space-y-2 rounded-lg bg-muted/40 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">
                        {i + 1}. {item.name} <span className="font-normal text-muted-foreground">{item.presentation}</span>
                      </p>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remover ${item.name}`} onClick={() => setItems((l) => l.filter((_, j) => j !== i))}>
                        <Trash2 />
                      </Button>
                    </div>
                    <Input aria-label={`Posologia de ${item.name}`} value={item.dosage} onChange={(e) => setItems((l) => l.map((x, j) => (j === i ? { ...x, dosage: e.target.value } : x)))} />
                    <Input aria-label={`Quantidade de ${item.name}`} placeholder="Quantidade" value={item.quantity ?? ""} onChange={(e) => setItems((l) => l.map((x, j) => (j === i ? { ...x, quantity: e.target.value || null } : x)))} />
                  </div>
                ))}
                {specialNeeded ? (
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    Há medicamento de controle especial: use o modelo “Receituário de controle especial” (2 vias), exigido pela RDC 471/2021.
                  </p>
                ) : null}
              </section>
            ) : null}

            <DialogFooter>
              <Button onClick={makePreview} disabled={pending || !template || (clinical && !professionals.length)}>
                {pending ? "Preparando..." : "Pré-visualizar"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
