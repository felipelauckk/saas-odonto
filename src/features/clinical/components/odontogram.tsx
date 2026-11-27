"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "cn";

import { Maximize2, Minimize2, Printer } from "lucide-react";

import { SegmentedControl } from "@/components/app/segmented-control";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";

import {
  ARCHES,
  PLANNED_COLOR,
  conditionColors,
  conditionLabels,
  currentState,
  faceLabel,
  isUpperTooth,
  plannedFaces,
  wholeFills,
  type Face,
  type ToothState,
} from "../odontogram";
import { PlanChecklist, type PatientPlan } from "./plan-checklist";
import { ToothPanel, type ToothRecord } from "./tooth-panel";
import { ToothSilhouette, WHEEL_BUTTONS, WHEEL_PATHS, type WheelSlot } from "./tooth-shape";

type Props = {
  patientId: string;
  records: ToothRecord[];
  canWrite: boolean;
  canMarkDone: boolean;
  startWithDeciduous: boolean;
  plan: PatientPlan | null;
  /** A leitura do plano falhou: mostra o aviso no lugar do checklist. */
  planFailed?: boolean;
};

type View = "permanent" | "deciduous" | "mixed" | "history";

/** Quadrantes do lado direito do paciente aparecem à esquerda: a mesial fica à direita. */
function mesialOnRight(tooth: number) {
  return [1, 4, 5, 8].includes(Math.floor(tooth / 10));
}

/** Em que posição do círculo fica cada face (visão do dentista, de frente para o paciente). */
function faceSlots(tooth: number): Record<Face, WheelSlot> {
  const upper = isUpperTooth(tooth);
  const mesialRight = mesialOnRight(tooth);
  return {
    V: upper ? "top" : "bottom",
    L: upper ? "bottom" : "top",
    M: mesialRight ? "right" : "left",
    D: mesialRight ? "left" : "right",
    O: "center",
  };
}

/**
 * Encolhe o desenho para caber na largura do cartão (sem barra de rolagem).
 * Abaixo de 55% os dentes ficariam pequenos demais para tocar: aí rola de
 * lado, sem barra visível.
 */
function useFitWidth(deps: unknown[]) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const measure = () => {
      const current = Number(i.style.zoom || 1);
      const natural = i.getBoundingClientRect().width / current;
      const available = o.clientWidth - (parseFloat(getComputedStyle(o).paddingLeft) + parseFloat(getComputedStyle(o).paddingRight));
      if (!natural || !available) return;
      const next = Math.max(0.55, Math.min(1, Math.floor((available / natural) * 100) / 100));
      setScale((s) => (Math.abs(s - next) < 0.01 ? s : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(o);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remede quando a visão muda
  }, deps);
  return { outer, inner, scale };
}

const FACE_ORDER: Face[] = ["V", "M", "O", "D", "L"];

function Tooth({
  tooth,
  state,
  planned,
  selected,
  selectedFaces,
  onSelect,
}: {
  tooth: number;
  state: ToothState | undefined;
  planned: Face[];
  selected: boolean;
  selectedFaces: Face[];
  onSelect: (face: Face | null) => void;
}) {
  const upper = isUpperTooth(tooth);
  const whole = state?.whole ?? null;
  const slots = faceSlots(tooth);

  const wholeButton = (
    <button
      type="button"
      onClick={() => onSelect(null)}
      aria-label={`Dente ${tooth} inteiro${whole ? `: ${conditionLabels[whole]}` : ""}`}
      aria-pressed={selected && selectedFaces.length === 0}
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg px-0.5 pt-1 text-xs font-semibold tabular-nums outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
        upper ? "flex-col" : "flex-col-reverse pb-1",
        selected ? "text-accent-foreground" : "text-muted-foreground",
      )}
    >
      <span>{tooth}</span>
      <ToothSilhouette tooth={tooth} upper={upper} whole={whole} />
    </button>
  );

  const wheel = (
    <div className={cn("relative size-11", whole === "missing" && "opacity-50")}>
      {FACE_ORDER.map((face) => {
        const condition = state?.faces[face];
        const isSelected = selected && selectedFaces.includes(face);
        const isPlanned = !condition && planned.includes(face);
        const fill = isSelected
          ? "color-mix(in oklab, var(--primary) 45%, var(--tooth-surface))"
          : condition
            ? conditionColors[condition]
            : isPlanned
              ? PLANNED_COLOR
              : ((whole && wholeFills[whole]) ?? "var(--tooth-surface)");
        return (
          <button
            key={face}
            type="button"
            onClick={() => onSelect(face)}
            aria-label={`Dente ${tooth}, face ${faceLabel(face, tooth)}${condition ? `: ${conditionLabels[condition]}` : isPlanned ? ": planejado" : ""}`}
            aria-pressed={isSelected}
            className="absolute outline-none hover:brightness-95 focus-visible:brightness-75"
            style={{
              ...WHEEL_BUTTONS[slots[face]].box,
              clipPath: `path("${WHEEL_BUTTONS[slots[face]].clip}")`,
              backgroundColor: fill,
            }}
          />
        );
      })}
      <svg viewBox="0 0 44 44" className="pointer-events-none absolute inset-0 size-full" aria-hidden>
        {Object.values(WHEEL_PATHS).map((d) => (
          <path key={d} d={d} fill="none" stroke="var(--tooth-outline)" strokeWidth={1} />
        ))}
      </svg>
    </div>
  );

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 rounded-xl py-1.5 transition-colors has-[button:focus-visible]:bg-muted",
        selected && "bg-accent ring-2 ring-primary ring-inset",
      )}
    >
      {upper ? wholeButton : wheel}
      {upper ? wheel : wholeButton}
    </div>
  );
}

const LEGEND = [
  {
    label: "Cárie",
    fill: conditionColors.caries,
    line: conditionColors.caries,
  },
  {
    label: "Restaurado",
    fill: conditionColors.restored,
    line: conditionColors.restored,
  },
  { label: "Planejado", fill: PLANNED_COLOR, line: PLANNED_COLOR },
  { label: "Coroa", fill: wholeFills.crown, line: conditionColors.crown },
  {
    label: "Implante",
    fill: wholeFills.implant,
    line: conditionColors.implant,
  },
  {
    label: "Canal",
    fill: wholeFills.root_canal,
    line: conditionColors.root_canal,
  },
  { label: "Outro", fill: conditionColors.other, line: conditionColors.other },
  {
    label: "Ausente",
    fill: "var(--tooth-surface)",
    line: conditionColors.missing,
    dashed: true,
  },
];

export function Odontogram({ patientId, records, canWrite, canMarkDone, startWithDeciduous, plan, planFailed = false }: Props) {
  const [view, setView] = useState<View>(startWithDeciduous ? "deciduous" : "permanent");
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [selectedFaces, setSelectedFaces] = useState<Face[]>([]);
  const panelRef = useRef<HTMLElement>(null);
  const state = useMemo(() => currentState(records), [records]);
  const planned = useMemo(() => plannedFaces(plan?.items ?? [], state), [plan, state]);
  const history = useMemo(() => [...records].reverse(), [records]);

  // No celular o painel fica abaixo dos dentes: leva até ele ao trocar de dente.
  useEffect(() => {
    if (selectedTooth === null || !window.matchMedia("(max-width: 95.99rem)").matches) return;
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedTooth]);

  function select(tooth: number, face: Face | null) {
    if (tooth !== selectedTooth) {
      setSelectedTooth(tooth);
      setSelectedFaces(face ? [face] : []);
      return;
    }
    if (!face) {
      setSelectedFaces([]);
      return;
    }
    setSelectedFaces((faces) => (faces.includes(face) ? faces.filter((f) => f !== face) : [...faces, face]));
  }

  // Mista: permanentes por fora, decíduos menores por dentro.
  const arches: { teeth: readonly number[]; label: string; small?: boolean }[] =
    view === "deciduous"
      ? [
          { teeth: ARCHES.upperDeciduous, label: "Arcada superior" },
          { teeth: ARCHES.lowerDeciduous, label: "Arcada inferior" },
        ]
      : view === "mixed"
        ? [
            { teeth: ARCHES.upperPermanent, label: "Arcada superior, permanentes" },
            { teeth: ARCHES.upperDeciduous, label: "Arcada superior, decíduos", small: true },
            { teeth: ARCHES.lowerDeciduous, label: "Arcada inferior, decíduos", small: true },
            { teeth: ARCHES.lowerPermanent, label: "Arcada inferior, permanentes" },
          ]
        : [
            { teeth: ARCHES.upperPermanent, label: "Arcada superior" },
            { teeth: ARCHES.lowerPermanent, label: "Arcada inferior" },
          ];
  const [full, setFull] = useState(false);
  const { outer: fitOuter, inner: fitInner, scale: fitScale } = useFitWidth([view, full]);

  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFull(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1fr)_20rem] 2xl:items-start",
        full && "fixed inset-0 z-50 overflow-y-auto bg-background p-4 sm:p-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start",
      )}
      role={full ? "dialog" : undefined}
      aria-modal={full || undefined}
      aria-label={full ? "Odontograma em tela cheia" : undefined}
    >
      <section aria-labelledby="odontograma-titulo" className="min-w-0 space-y-5 rounded-card border bg-card p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h2 id="odontograma-titulo" className="type-section">
              Odontograma
            </h2>
            <p className="text-[0.8125rem] text-muted-foreground">
              {canWrite ? "Clique em um dente ou numa face para registrar" : "Clique em um dente para ver o histórico"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl<View>
              label="Visualização"
              value={view}
              onChange={setView}
              options={[
                { value: "permanent", label: "Permanentes" },
                { value: "deciduous", label: "Decíduos" },
                { value: "mixed", label: "Mista" },
                { value: "history", label: "Histórico" },
              ]}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => setFull((v) => !v)} aria-pressed={full}>
              {full ? <Minimize2 aria-hidden /> : <Maximize2 aria-hidden />}
              {full ? "Sair da tela cheia" : "Tela cheia"}
            </Button>
            <a
              href={`/pacientes/${patientId}/odontograma/imprimir`}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Printer aria-hidden />
              Imprimir
            </a>
          </div>
        </div>

        {view === "history" ? (
          history.length ? (
            <ul className="divide-y divide-border-soft">
              {history.map((r) => (
                <li key={r.id} className="flex items-start gap-3 py-2.5 text-sm">
                  <span className="mt-1 size-3 shrink-0 rounded-sm" style={{ backgroundColor: conditionColors[r.condition] }} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p>
                      <span className="font-semibold">Dente {r.tooth}</span>
                      {r.faces.length ? ` (${r.faces.map((f) => faceLabel(f as Face, r.tooth)).join(", ")})` : ""}: {conditionLabels[r.condition]}
                      {r.notes ? <span className="text-muted-foreground"> — {r.notes}</span> : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(r.created_at)}
                      {r.recordedBy ? ` · ${r.recordedBy}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed px-6 py-8 text-center text-sm text-muted-foreground">Nenhum registro no odontograma.</p>
          )
        ) : (
          <>
            <div ref={fitOuter} className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
              <div ref={fitInner} className="relative mx-auto w-max space-y-2" style={fitScale < 1 ? { zoom: fitScale } : undefined}>
                <div aria-hidden className="absolute inset-y-0 left-1/2 w-px bg-border" />
                <div aria-hidden className="absolute inset-x-0 top-1/2 h-px bg-border" />
                {arches.map(({ teeth, label, small }) => (
                  <div key={label} role="group" aria-label={label} className="relative flex justify-center gap-0.5" style={small ? { zoom: 0.78 } : undefined}>
                    {teeth.map((tooth, j) => (
                      <div key={tooth} className={cn(j === teeth.length / 2 && "ml-2")}>
                        <Tooth
                          tooth={tooth}
                          state={state.get(tooth)}
                          planned={planned.get(tooth) ?? []}
                          selected={selectedTooth === tooth}
                          selectedFaces={selectedFaces}
                          onSelect={(face) => select(tooth, face)}
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs" aria-label="Legenda">
              {LEGEND.map((l) => (
                <li key={l.label} className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className={cn("size-3 rounded-[0.25rem] border", l.dashed && "border-dashed")}
                    style={{ backgroundColor: l.fill, borderColor: l.line }}
                  />
                  {l.label}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <aside className="grid items-start gap-5 md:grid-cols-2 2xl:grid-cols-1" aria-label="Detalhes do odontograma">
        {selectedTooth !== null ? (
          <ToothPanel
            key={selectedTooth}
            ref={panelRef}
            patientId={patientId}
            tooth={selectedTooth}
            faces={selectedFaces}
            state={state.get(selectedTooth)}
            history={history.filter((r) => r.tooth === selectedTooth)}
            planItems={(plan?.items ?? []).filter((i) => i.tooth === selectedTooth && (i.status === "approved" || i.status === "done"))}
            canWrite={canWrite}
            canMarkDone={canMarkDone}
            onClose={() => setSelectedTooth(null)}
            onSaved={() => setSelectedFaces([])}
          />
        ) : (
          <p className="rounded-card border border-dashed px-5 py-6 text-center text-[0.8125rem] text-muted-foreground">
            Selecione um dente para ver o histórico
            {canWrite ? " e registrar" : ""}.
          </p>
        )}
        {plan ? <PlanChecklist plan={plan} /> : null}
        {planFailed ? (
          <p role="alert" className="rounded-card border px-5 py-4 text-[0.8125rem] text-muted-foreground">
            Não foi possível carregar o plano de tratamento agora.
          </p>
        ) : null}
      </aside>
    </div>
  );
}
