"use client";

import { useMemo, useState, useTransition } from "react";
import { cn } from "cn";

import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/format";

import { addToothRecord } from "../actions";
import {
  ARCHES,
  WHOLE_TOOTH,
  conditionColors,
  conditionLabels,
  conditions,
  currentState,
  faceLabel,
  type Face,
  type ToothCondition,
  type ToothState,
} from "../odontogram";

type RecordRow = {
  id: string;
  tooth: number;
  faces: string[];
  condition: ToothCondition;
  notes: string | null;
  recordedBy: string | null;
  created_at: string;
};

type Props = { patientId: string; records: RecordRow[]; canWrite: boolean; startWithDeciduous: boolean };

/** Lado do quadro onde fica a face mesial: quadrantes do lado direito do paciente aparecem à esquerda. */
function mesialOnRight(tooth: number) {
  return [1, 4, 5, 8].includes(Math.floor(tooth / 10));
}
function isUpper(tooth: number) {
  return [1, 2, 5, 6].includes(Math.floor(tooth / 10));
}

/**
 * Área de cada face: cada botão tem o próprio retângulo (faixa do lado ou
 * quadrado central) e o recorte em trapézio. Os cinco formam o dente sem sobrepor.
 */
type FaceArea = { box: string; clip?: string };

const AREAS = {
  top: { box: "inset-x-0 top-0 h-[30%]", clip: "polygon(0 0, 100% 0, 70% 100%, 30% 100%)" },
  bottom: { box: "inset-x-0 bottom-0 h-[30%]", clip: "polygon(30% 0, 70% 0, 100% 100%, 0 100%)" },
  left: { box: "inset-y-0 left-0 w-[30%]", clip: "polygon(0 0, 100% 30%, 100% 70%, 0 100%)" },
  right: { box: "inset-y-0 right-0 w-[30%]", clip: "polygon(0 30%, 100% 0, 100% 100%, 0 70%)" },
  center: { box: "inset-[30%]" },
} satisfies Record<string, FaceArea>;

function faceAreas(tooth: number): Record<Face, FaceArea> {
  const upper = isUpper(tooth);
  const mesialRight = mesialOnRight(tooth);
  return {
    V: upper ? AREAS.top : AREAS.bottom,
    L: upper ? AREAS.bottom : AREAS.top,
    M: mesialRight ? AREAS.right : AREAS.left,
    D: mesialRight ? AREAS.left : AREAS.right,
    O: AREAS.center,
  };
}

function Tooth({
  tooth,
  state,
  selected,
  selectedFaces,
  onSelectFace,
  onSelectTooth,
}: {
  tooth: number;
  state: ToothState | undefined;
  selected: boolean;
  selectedFaces: Face[];
  onSelectFace: (face: Face) => void;
  onSelectTooth: () => void;
}) {
  const areas = faceAreas(tooth);
  const whole = state?.whole ?? null;
  const upper = isUpper(tooth);

  const number = (
    <button
      type="button"
      onClick={onSelectTooth}
      aria-label={`Dente ${tooth} inteiro${whole ? `: ${conditionLabels[whole]}` : ""}`}
      aria-pressed={selected && selectedFaces.length === 0}
      className={cn(
        "flex h-6 w-11 items-center justify-center rounded text-xs font-medium tabular-nums transition-colors hover:bg-muted",
        selected && "bg-primary text-primary-foreground hover:bg-primary",
      )}
    >
      {tooth}
    </button>
  );

  return (
    <div className="flex flex-col items-center gap-1">
      {upper ? number : null}
      <div
        className={cn("relative size-11 rounded-sm border-2 bg-background", selected ? "border-primary" : "border-border")}
        style={whole && whole !== "missing" ? { borderColor: conditionColors[whole], borderWidth: 3 } : undefined}
      >
        {(Object.keys(areas) as Face[]).map((face) => {
          const condition = state?.faces[face];
          const isSelected = selected && selectedFaces.includes(face);
          return (
            <button
              key={face}
              type="button"
              onClick={() => onSelectFace(face)}
              aria-label={`Dente ${tooth}, face ${faceLabel(face, tooth)}${condition ? `: ${conditionLabels[condition]}` : ""}`}
              aria-pressed={isSelected}
              className={cn(
                "absolute outline-none transition-colors focus-visible:bg-primary/30",
                areas[face].box,
                !condition && !isSelected && "hover:bg-primary/15",
                isSelected && "bg-primary/40",
              )}
              style={{
                clipPath: areas[face].clip,
                backgroundColor: condition && !isSelected ? conditionColors[condition] : undefined,
              }}
            />
          );
        })}
        {/* Contornos das faces */}
        <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 size-full text-border" aria-hidden>
          <path d="M0 0 L30 30 M100 0 L70 30 M0 100 L30 70 M100 100 L70 70" stroke="currentColor" strokeWidth="2" />
          <rect x="30" y="30" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
        {whole === "missing" ? (
          <svg viewBox="0 0 100 100" className="pointer-events-none absolute -inset-1" aria-hidden>
            <path d="M8 8 L92 92 M92 8 L8 92" stroke={conditionColors.missing} strokeWidth="9" strokeLinecap="round" />
          </svg>
        ) : null}
        {whole === "root_canal" ? (
          <span
            className="pointer-events-none absolute left-1/2 w-1 -translate-x-1/2 rounded-full"
            style={{ backgroundColor: conditionColors.root_canal, top: upper ? -10 : "auto", bottom: upper ? "auto" : -10, height: 10 }}
            aria-hidden
          />
        ) : null}
        {whole === "implant" ? (
          <span className="pointer-events-none absolute -right-1.5 -bottom-1.5 rounded bg-background px-0.5 text-[10px] font-bold" style={{ color: conditionColors.implant }} aria-hidden>
            I
          </span>
        ) : null}
      </div>
      {!upper ? number : null}
    </div>
  );
}

function Arch({ teeth, ...props }: { teeth: readonly number[] } & Omit<Parameters<typeof Tooth>[0], "tooth" | "state" | "selected" | "onSelectFace" | "onSelectTooth"> & {
  state: Map<number, ToothState>;
  selectedTooth: number | null;
  onSelect: (tooth: number, face: Face | null) => void;
}) {
  const half = teeth.length / 2;
  return (
    <div className="flex justify-center gap-1">
      {teeth.map((tooth, i) => (
        <div key={tooth} className={cn("flex", i === half && "ml-3 border-l pl-3 sm:ml-4 sm:pl-4")}>
          <Tooth
            tooth={tooth}
            state={props.state.get(tooth)}
            selected={props.selectedTooth === tooth}
            selectedFaces={props.selectedFaces}
            onSelectFace={(face) => props.onSelect(tooth, face)}
            onSelectTooth={() => props.onSelect(tooth, null)}
          />
        </div>
      ))}
    </div>
  );
}

export function Odontogram({ patientId, records, canWrite, startWithDeciduous }: Props) {
  const [dentition, setDentition] = useState<"permanent" | "deciduous">(startWithDeciduous ? "deciduous" : "permanent");
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [selectedFaces, setSelectedFaces] = useState<Face[]>([]);
  const [condition, setCondition] = useState<ToothCondition>("caries");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<{ status: "error" | "success"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const state = useMemo(() => currentState(records), [records]);

  function select(tooth: number, face: Face | null) {
    setMessage(null);
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

  function save() {
    if (selectedTooth === null) return;
    startTransition(async () => {
      const result = await addToothRecord({ patientId, tooth: selectedTooth, faces: selectedFaces, condition, notes });
      if (result.error) {
        setMessage({ status: "error", message: result.error });
      } else {
        setMessage({ status: "success", message: `Dente ${selectedTooth}: ${conditionLabels[condition]} registrado.` });
        setSelectedFaces([]);
        setNotes("");
      }
    });
  }

  const arches =
    dentition === "permanent"
      ? [ARCHES.upperPermanent, ARCHES.lowerPermanent]
      : [ARCHES.upperDeciduous, ARCHES.lowerDeciduous];
  const wholeOnly = WHOLE_TOOTH.includes(condition);
  const history = [...records].reverse();

  const segment = (active: boolean) =>
    cn(
      "h-8 rounded-md px-3 text-sm font-medium transition-colors pointer-coarse:h-11",
      active ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg bg-muted p-1" role="group" aria-label="Dentição">
          <button type="button" className={segment(dentition === "permanent")} aria-pressed={dentition === "permanent"} onClick={() => setDentition("permanent")}>
            Permanentes
          </button>
          <button type="button" className={segment(dentition === "deciduous")} aria-pressed={dentition === "deciduous"} onClick={() => setDentition("deciduous")}>
            Decíduos
          </button>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legenda">
          {conditions
            .filter((c) => c !== "healthy")
            .map((c) => (
              <li key={c} className="flex items-center gap-1.5">
                <span className="size-3 rounded-sm" style={{ backgroundColor: conditionColors[c] }} aria-hidden />
                {conditionLabels[c]}
              </li>
            ))}
        </ul>
      </div>

      <div className="overflow-x-auto rounded-xl border p-4 sm:p-6">
        <div className="mx-auto w-max space-y-6">
          {arches.map((teeth, i) => (
            <Arch
              key={i}
              teeth={teeth}
              state={state}
              selectedTooth={selectedTooth}
              selectedFaces={selectedFaces}
              onSelect={select}
            />
          ))}
        </div>
      </div>

      {canWrite ? (
        selectedTooth !== null ? (
          <section className="space-y-4 rounded-xl border p-5 sm:p-6" aria-labelledby="registro-dente">
            <div className="space-y-1">
              <h2 id="registro-dente" className="text-base font-medium">
                Dente {selectedTooth}
              </h2>
              <p className="text-sm text-muted-foreground">
                {wholeOnly || selectedFaces.length === 0
                  ? "Dente inteiro"
                  : `Faces: ${selectedFaces.map((f) => faceLabel(f, selectedTooth)).join(", ")}`}
                {" · "}clique nas faces do desenho para escolher.
              </p>
            </div>
            {message ? <FormMessage state={message} /> : null}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Condição">
              {conditions.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={condition === c}
                  onClick={() => setCondition(c)}
                  className={cn(
                    "flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors pointer-coarse:h-11",
                    condition === c ? "border-foreground bg-muted" : "hover:bg-muted",
                  )}
                >
                  <span
                    className="size-3 shrink-0 rounded-sm border"
                    style={{ backgroundColor: conditionColors[c] }}
                    aria-hidden
                  />
                  {conditionLabels[c]}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tooth-notes">Observação (opcional)</Label>
              <Input id="tooth-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" onClick={save} disabled={pending}>
                {pending ? "Registrando..." : "Registrar"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setSelectedTooth(null)}>
                Fechar
              </Button>
            </div>
          </section>
        ) : (
          <p className="text-sm text-muted-foreground">Clique num dente (no número) ou numa face para registrar.</p>
        )
      ) : null}

      <section className="space-y-2" aria-labelledby="historico-odontograma">
        <h2 id="historico-odontograma" className="text-sm font-medium text-muted-foreground">
          Histórico
        </h2>
        {history.length ? (
          <ul className="divide-y rounded-xl border">
            {history.map((r) => (
              <li key={r.id} className="flex items-start gap-3 px-4 py-2.5 text-sm sm:px-5">
                <span className="mt-1 size-3 shrink-0 rounded-sm border" style={{ backgroundColor: conditionColors[r.condition] }} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p>
                    <span className="font-medium">Dente {r.tooth}</span>
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
        )}
      </section>
    </div>
  );
}
