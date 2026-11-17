"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Sparkles, X } from "lucide-react";
import { cn } from "cn";

import { FormMessage } from "@/components/forms/form-message";
import { SimpleSelect } from "@/components/forms/simple-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/format";
import { centsToInput, parseBRLToCents } from "@/lib/money";

import { ARCHES, conditionLabels, faceLabel, type Face, type ToothCondition } from "@/features/clinical/odontogram";
import { PatientPicker } from "@/features/agenda/components/patient-picker";
import type { PatientOption } from "@/features/agenda/actions";

import { VoiceDictation } from "@/features/ai/components/voice-dictation";

import { savePlan } from "../actions";
import { uncoveredSuggestions } from "../builder-logic";

type Procedure = { id: string; name: string; price_cents: number; applies_to_tooth: boolean; category: string | null };
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
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/**
 * Montar orçamento em três colunas: catálogo (busca e categorias), plano
 * proposto (itens e avisos do odontograma) e resumo com o total.
 */
export function PlanBuilder(props: Props) {
  const router = useRouter();
  const [patient, setPatient] = useState(props.patient);
  const [professionalId, setProfessionalId] = useState(props.professionalId);
  const [items, setItems] = useState<Item[]>(() => props.initialItems.map((i) => ({ ...i, key: key() })));
  const [notes, setNotes] = useState(props.initialNotes);
  const [validUntil, setValidUntil] = useState(props.initialValidUntil ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Catálogo
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const categories = useMemo(() => [...new Set(props.procedures.map((p) => p.category).filter((c): c is string => Boolean(c)))].sort(), [props.procedures]);
  const catalog = useMemo(() => {
    const q = normalize(query.trim());
    return props.procedures.filter((p) => (!category || p.category === category) && (!q || normalize(p.name).includes(q)));
  }, [props.procedures, query, category]);

  // Formulário de inclusão
  const [procedureId, setProcedureId] = useState(props.procedures[0]?.id ?? "");
  const [tooth, setTooth] = useState<number | null>(null);
  const [faces, setFaces] = useState<Face[]>([]);
  const [price, setPrice] = useState(props.procedures[0] ? centsToInput(props.procedures[0].price_cents) : "0,00");
  const procedure = props.procedures.find((p) => p.id === procedureId);
  const total = useMemo(() => items.reduce((s, i) => s + i.priceCents, 0), [items]);
  const pendingSuggestions = useMemo(() => uncoveredSuggestions(props.suggestions, items), [props.suggestions, items]);

  function chooseProcedure(id: string) {
    setProcedureId(id);
    const p = props.procedures.find((x) => x.id === id);
    if (p) setPrice(centsToInput(p.price_cents));
    if (p && !p.applies_to_tooth) {
      setTooth(null);
      setFaces([]);
    }
  }

  /** Do catálogo: sem dente entra direto; com dente, prepara o formulário para escolher o dente. */
  function pickFromCatalog(p: Procedure) {
    chooseProcedure(p.id);
    if (!p.applies_to_tooth) {
      setError(null);
      setItems((list) => [...list, { key: key(), procedureId: p.id, description: p.name, tooth: null, faces: [], priceCents: p.price_cents }]);
    } else {
      document.getElementById("plan-tooth")?.focus();
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
    document.getElementById("incluir-item")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
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

  const chip = (active: boolean) =>
    cn(
      "inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-[0.8125rem] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40 pointer-coarse:h-11",
      active ? "border-brand-deep bg-brand-deep text-brand-deep-foreground" : "border-input bg-card hover:bg-muted",
    );

  return (
    <div className="space-y-4">
      {error ? <FormMessage state={{ status: "error", message: error }} /> : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[19rem_minmax(0,1fr)_19rem] xl:items-start">
        {/* Catálogo e inclusão */}
        <div className="min-w-0 space-y-4">
          <section aria-labelledby="catalogo" className="space-y-3 rounded-card border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 id="catalogo" className="type-section">
                Procedimentos
              </h2>
              <VoiceDictation
                kind="plan"
                title="Ditar orçamento"
                context={{ procedures: props.procedures.map((p) => ({ id: p.id, name: p.name })) }}
                onResult={(r) => {
                  // Itens entram na lista para revisão; nada é salvo até "Salvar".
                  const added: Item[] = r.data.items.map((it) => {
                    const p = props.procedures.find((x) => x.id === it.procedureId);
                    const t = p?.applies_to_tooth && it.tooth && (ALL_TEETH as number[]).includes(it.tooth) ? it.tooth : null;
                    return { key: key(), procedureId: p?.id ?? null, description: p?.name ?? it.description, tooth: t, faces: t ? it.faces : [], priceCents: p?.price_cents ?? 0 };
                  });
                  setItems((list) => [...list, ...added]);
                  if (added.some((i) => !i.procedureId)) setError("Alguns itens ditados não correspondem a procedimentos cadastrados: confira o valor antes de salvar.");
                }}
              />
            </div>
            <label className="relative block">
              <span className="sr-only">Buscar procedimento</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar procedimento"
                className="h-10 w-full rounded-lg border border-input bg-card pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 pointer-coarse:h-11"
              />
            </label>
            {categories.length ? (
              <div role="group" aria-label="Categorias" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                <button type="button" aria-pressed={category === null} onClick={() => setCategory(null)} className={chip(category === null)}>
                  Todos
                </button>
                {categories.map((c) => (
                  <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)} className={chip(category === c)}>
                    {c}
                  </button>
                ))}
              </div>
            ) : null}
            {catalog.length ? (
              <ul className="-mx-1 max-h-80 overflow-y-auto">
                {catalog.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => pickFromCatalog(p)}
                      aria-label={`${p.applies_to_tooth ? "Escolher" : "Incluir"} ${p.name}`}
                      className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40"
                    >
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[0.8125rem] font-medium">{p.name}</span>
                        <span className="text-xs text-muted-foreground">{p.applies_to_tooth ? "Por dente" : (p.category ?? "Geral")}</span>
                      </span>
                      <span className="text-[0.8125rem] text-muted-foreground tabular-nums">{p.price_cents ? formatCurrency(p.price_cents) : "sem preço"}</span>
                      <Plus className="size-4 shrink-0 text-primary" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-4 text-center text-[0.8125rem] text-muted-foreground">Nenhum procedimento com esse nome.</p>
            )}
          </section>

          <section className="space-y-4 rounded-card border bg-card p-4" aria-labelledby="incluir-item">
            <h2 id="incluir-item" className="type-section">
              Incluir procedimento
            </h2>
            <SimpleSelect
              id="plan-procedure"
              label="Procedimento"
              value={procedureId}
              onChange={chooseProcedure}
              options={props.procedures.map((p) => ({ value: p.id, label: p.name }))}
            />
            {procedure?.applies_to_tooth ? (
              <>
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
                  <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="plan-faces">
                    {FACE_ORDER.map((f) => (
                      <button
                        key={f}
                        type="button"
                        disabled={!tooth}
                        aria-pressed={faces.includes(f)}
                        onClick={() => setFaces((list) => (list.includes(f) ? list.filter((x) => x !== f) : [...list, f]))}
                        className={cn(
                          "h-9 rounded-lg border px-2.5 text-[0.8125rem] transition-colors disabled:opacity-50 pointer-coarse:h-11",
                          faces.includes(f) ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                        )}
                      >
                        {tooth ? faceLabel(f, tooth) : f}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="plan-price">Valor (R$)</Label>
              <Input id="plan-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <Button type="button" variant="outline" onClick={addItem} disabled={!procedure} className="w-full">
              <Plus aria-hidden />
              Incluir no orçamento
            </Button>
          </section>
        </div>

        {/* Plano proposto */}
        <section aria-labelledby="itens-orcamento" className="min-w-0 space-y-3 rounded-card border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="itens-orcamento" className="type-section">
              Plano proposto
            </h2>
            <span className="text-[0.8125rem] text-muted-foreground">{items.length === 1 ? "1 procedimento" : `${items.length} procedimentos`}</span>
          </div>
          {items.length ? (
            <ul className="divide-y divide-border-soft">
              {items.map((item) => (
                <li key={item.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{item.description}</p>
                    {item.tooth ? (
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="rounded-md bg-accent px-1.5 py-0.5 font-semibold text-accent-foreground tabular-nums">{item.tooth}</span>
                        {item.faces.length ? item.faces.map((f) => faceLabel(f, item.tooth!)).join(", ") : "dente inteiro"}
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
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
              Nenhum item ainda. Escolha procedimentos no catálogo.
            </p>
          )}

          {pendingSuggestions.length ? (
            <ul className="space-y-2" aria-label="Avisos do odontograma">
              {pendingSuggestions.map((s) => (
                <li key={`${s.tooth}-${s.condition}-${s.faces.join("")}`} className="flex items-center gap-3 rounded-lg bg-warning-soft px-3 py-2.5 text-[0.8125rem] text-warning">
                  <Sparkles className="size-4 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 text-foreground">
                    {s.condition === "missing" ? (
                      <>
                        O odontograma marca o <strong>dente {s.tooth}</strong> como ausente, e ele não está neste orçamento.
                      </>
                    ) : (
                      <>
                        O odontograma tem {s.condition === "caries" ? "cárie" : "um registro"} no <strong>dente {s.tooth}</strong>
                        {s.faces.length ? ` (${s.faces.map((f) => faceLabel(f, s.tooth).toLowerCase()).join(", ")})` : ""} que não está neste orçamento.
                      </>
                    )}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applySuggestion(s)}
                    aria-label={`${s.tooth} · ${conditionLabels[s.condition]}${s.faces.length ? ` (${s.faces.join(", ")})` : ""}: incluir`}
                  >
                    Incluir
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="space-y-1.5 border-t border-border-soft pt-3">
            <Label htmlFor="plan-notes">Observações</Label>
            <Textarea id="plan-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </section>

        {/* Resumo */}
        <aside className="min-w-0 space-y-4" aria-label="Resumo do orçamento">
          <section className="space-y-4 rounded-card border bg-card p-4" aria-label="Paciente e profissional">
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
            <div className="space-y-1.5">
              <Label htmlFor="plan-valid">Válido até</Label>
              <Input id="plan-valid" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
          </section>
          <section className="space-y-4 rounded-card bg-brand-deep p-5 text-brand-deep-foreground" aria-label="Total">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm text-brand-deep-foreground/80">Total</span>
              <span className="type-title tabular-nums">{formatCurrency(total)}</span>
            </div>
            <p className="text-xs text-brand-deep-foreground/70">Desconto, forma de pagamento e parcelas são definidos na aprovação.</p>
            <Button type="button" variant="on-dark" onClick={submit} disabled={pending || !items.length} className="w-full">
              {pending ? "Salvando..." : props.planId ? "Salvar alterações" : "Criar orçamento"}
            </Button>
          </section>
        </aside>
      </div>
    </div>
  );
}
