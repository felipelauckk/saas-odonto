"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "cn";

import { minutesToTime, utcToZoned } from "@/lib/timezone";

import { FREEING_STATUSES, HOUR_HEIGHT, SNAP_MINUTES, statusLabels } from "../labels";
import { computeLanes, minutesFromOffset } from "../layout";
import type { AgendaAppointment, AgendaBlock } from "../queries";

export type GridColumn = {
  key: string;
  label: string;
  sublabel?: string;
  color?: string;
  date: string;
  /** Profissional da coluna (null na visão por cadeira). */
  professionalId: string | null;
  /** Cadeira da coluna (undefined = visão por profissional; null = "sem cadeira"). */
  chairId?: string | null;
  isToday: boolean;
  appointments: AgendaAppointment[];
  blocks: AgendaBlock[];
  /** Períodos de expediente (minutos do dia); fora deles a grade fica apagada. */
  working: { startMin: number; endMin: number }[] | null;
};

export type MoveTarget = { appointment: AgendaAppointment; column: GridColumn; startMin: number };

type Props = {
  columns: GridColumn[];
  range: { startMin: number; endMin: number };
  colorFor: (professionalId: string) => string;
  onSlotClick: (column: GridColumn, startMin: number) => void;
  onAppointmentClick: (appointment: AgendaAppointment) => void;
  onBlockClick: (block: AgendaBlock) => void;
  onMove: (target: MoveTarget) => Promise<boolean>;
};

const px = (minutes: number) => (minutes / 60) * HOUR_HEIGHT;

function nowInSaoPaulo() {
  return utcToZoned(new Date()).minutes;
}

type Drag = {
  appointment: AgendaAppointment;
  pointerId: number;
  originX: number;
  originY: number;
  /** Distância entre o topo do cartão e o ponteiro, em minutos. */
  grabOffsetMin: number;
  moved: boolean;
  colIndex: number;
  startMin: number;
};

export function AgendaGrid({ columns, range, colorFor, onSlotClick, onAppointmentClick, onBlockClick, onMove }: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  // Depois de arrastar, o navegador ainda dispara um clique: ele é ignorado.
  const suppressClick = useRef(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [pendingMove, setPendingMove] = useState<{ id: string; colIndex: number; startMin: number } | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const height = px(range.endMin - range.startMin);

  // Hora atual só no navegador (evita diferença entre servidor e cliente).
  useEffect(() => {
    const tick = () => setNow(nowInSaoPaulo());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  // Dados novos chegaram: a posição otimista não é mais necessária.
  const [seenColumns, setSeenColumns] = useState(columns);
  if (seenColumns !== columns) {
    setSeenColumns(columns);
    setPendingMove(null);
  }

  const hours: number[] = [];
  for (let m = range.startMin; m < range.endMin; m += 60) hours.push(m);
  const slots: number[] = [];
  for (let m = range.startMin; m < range.endMin; m += 30) slots.push(m);

  function locate(clientX: number, clientY: number, grabOffsetMin: number) {
    const elements = document.elementsFromPoint(clientX, clientY);
    const colEl = elements.find((el) => el instanceof HTMLElement && el.dataset.colIndex !== undefined) as
      | HTMLElement
      | undefined;
    if (!colEl) return null;
    const rect = colEl.getBoundingClientRect();
    const colIndex = Number(colEl.dataset.colIndex);
    const raw = minutesFromOffset(clientY - rect.top, HOUR_HEIGHT, range.startMin, SNAP_MINUTES) - grabOffsetMin;
    const startMin = Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES;
    return { colIndex, startMin };
  }

  function onPointerDown(e: React.PointerEvent, appointment: AgendaAppointment, colIndex: number) {
    // No toque, arrastar atrapalharia a rolagem: remarcar fica no "Editar ou remarcar".
    if (e.pointerType === "touch" || e.button !== 0) return;
    if (FREEING_STATUSES.includes(appointment.status)) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const grabOffsetMin = Math.floor(((e.clientY - rect.top) / HOUR_HEIGHT) * 60 / SNAP_MINUTES) * SNAP_MINUTES;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({
      appointment,
      pointerId: e.pointerId,
      originX: e.clientX,
      originY: e.clientY,
      grabOffsetMin,
      moved: false,
      colIndex,
      startMin: appointment.startMin,
    });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const moved = drag.moved || Math.hypot(e.clientX - drag.originX, e.clientY - drag.originY) > 5;
    if (!moved) return;
    const target = locate(e.clientX, e.clientY, drag.grabOffsetMin);
    const duration = drag.appointment.endMin - drag.appointment.startMin;
    setDrag({
      ...drag,
      moved: true,
      ...(target
        ? {
            colIndex: target.colIndex,
            startMin: Math.min(Math.max(target.startMin, 0), 24 * 60 - duration),
          }
        : {}),
    });
  }

  async function onPointerUp(e: React.PointerEvent) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const current = drag;
    setDrag(null);
    if (!current.moved) return; // o onClick abre os detalhes
    suppressClick.current = true;
    const column = columns[current.colIndex];
    const unchanged =
      column &&
      current.startMin === current.appointment.startMin &&
      column.date === current.appointment.date &&
      (column.professionalId === null || column.professionalId === current.appointment.professionalId) &&
      (column.chairId === undefined || column.chairId === current.appointment.chairId);
    if (!column || unchanged) return;

    setPendingMove({ id: current.appointment.id, colIndex: current.colIndex, startMin: current.startMin });
    const ok = await onMove({ appointment: current.appointment, column, startMin: current.startMin });
    if (!ok) setPendingMove(null);
  }

  return (
    <div className="overflow-auto rounded-xl border" style={{ maxHeight: "calc(100dvh - 15rem)", minHeight: "24rem" }}>
      <div className="relative min-w-full" style={{ width: "max-content" }} ref={gridRef}>
        {/* Cabeçalho */}
        <div className="sticky top-0 z-20 flex border-b bg-background">
          <div className="sticky left-0 z-10 w-14 shrink-0 border-r bg-background" />
          {columns.map((col) => (
            <div
              key={col.key}
              className={cn(
                "flex min-w-40 flex-1 items-center gap-2 border-r px-3 py-2 last:border-r-0 sm:min-w-48",
                col.isToday && "bg-primary/5",
              )}
            >
              {col.color ? <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: col.color }} aria-hidden /> : null}
              <div className="min-w-0">
                <p className={cn("truncate text-sm font-medium", col.isToday && "text-primary")}>{col.label}</p>
                {col.sublabel ? <p className="truncate text-xs text-muted-foreground">{col.sublabel}</p> : null}
              </div>
            </div>
          ))}
        </div>

        <div className="flex">
          {/* Horas */}
          <div className="sticky left-0 z-10 w-14 shrink-0 border-r bg-background" style={{ height }}>
            {hours.map((m) => (
              <div key={m} className="absolute right-2 -translate-y-1/2 text-xs text-muted-foreground tabular-nums" style={{ top: px(m - range.startMin) }}>
                {m === range.startMin ? null : minutesToTime(m)}
              </div>
            ))}
          </div>

          {columns.map((col, colIndex) => {
            const lanes = computeLanes(col.appointments.filter((a) => !FREEING_STATUSES.includes(a.status)));
            return (
              <div
                key={col.key}
                data-col-index={colIndex}
                className={cn("relative min-w-40 flex-1 border-r last:border-r-0 sm:min-w-48", col.isToday && "bg-primary/[0.02]")}
                style={{ height }}
              >
                {/* Fora do expediente */}
                {col.working ? (
                  <div className="pointer-events-none absolute inset-0 bg-muted/60">
                    {col.working.map((w, i) => (
                      <div
                        key={i}
                        className="absolute inset-x-0 bg-background"
                        style={{ top: px(w.startMin - range.startMin), height: px(w.endMin - w.startMin) }}
                      />
                    ))}
                  </div>
                ) : null}

                {/* Linhas e horários livres clicáveis */}
                {slots.map((m) => (
                  <button
                    key={m}
                    type="button"
                    tabIndex={-1}
                    aria-label={`Marcar consulta ${col.label} às ${minutesToTime(m)}`}
                    onClick={() => onSlotClick(col, m)}
                    className={cn(
                      "absolute inset-x-0 border-t border-border/60 hover:bg-primary/5 focus-visible:bg-primary/10 focus-visible:outline-none",
                      m % 60 !== 0 && "border-dashed border-border/40",
                    )}
                    style={{ top: px(m - range.startMin), height: px(30) }}
                  />
                ))}

                {/* Bloqueios */}
                {col.blocks.map((b) => {
                  const start = Math.max(b.startMin, range.startMin);
                  const end = Math.min(b.endMin, range.endMin);
                  if (end <= start) return null;
                  return (
                    <button
                      key={`${b.id}-${b.date}`}
                      type="button"
                      onClick={() => onBlockClick(b)}
                      className="absolute inset-x-0 z-[1] overflow-hidden border-y border-muted-foreground/20 bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,var(--color-muted)_6px,var(--color-muted)_12px)] px-2 py-1 text-left text-xs text-muted-foreground"
                      style={{ top: px(start - range.startMin), height: px(end - start) }}
                    >
                      <span className="rounded bg-background/90 px-1">
                        {b.reason || "Bloqueado"} · {minutesToTime(b.startMin)}–{minutesToTime(b.endMin === 1440 ? 1439 : b.endMin)}
                      </span>
                    </button>
                  );
                })}

                {/* Consultas */}
                {col.appointments.map((a) => {
                  const isDragging = drag?.moved && drag.appointment.id === a.id;
                  const override = pendingMove?.id === a.id ? pendingMove : null;
                  if (override && override.colIndex !== colIndex) return null;
                  const startMin = override ? override.startMin : a.startMin;
                  const duration = a.endMin - a.startMin;
                  const freeing = FREEING_STATUSES.includes(a.status);
                  const lane = lanes.get(a.id) ?? { lane: 0, lanes: 1 };
                  const color = colorFor(a.professionalId);
                  const top = px(Math.max(startMin, range.startMin) - range.startMin);
                  const cardHeight = Math.max(px(Math.min(startMin + duration, range.endMin) - Math.max(startMin, range.startMin)), 22);
                  return (
                    <button
                      key={`${a.id}-${a.date}`}
                      type="button"
                      onPointerDown={(e) => onPointerDown(e, a, colIndex)}
                      onPointerMove={onPointerMove}
                      onPointerUp={onPointerUp}
                      onPointerCancel={() => setDrag(null)}
                      onClick={() => {
                        if (suppressClick.current) {
                          suppressClick.current = false;
                          return;
                        }
                        onAppointmentClick(a);
                      }}
                      aria-label={`${a.patientName}, ${minutesToTime(a.startMin)} a ${minutesToTime(a.endMin)}, ${statusLabels[a.status]}`}
                      className={cn(
                        "absolute z-[2] flex flex-col overflow-hidden rounded-md border-l-4 px-2 py-1 text-left text-xs shadow-xs outline-none transition-opacity focus-visible:ring-3 focus-visible:ring-ring/50",
                        freeing ? "z-[1] bg-muted/80 text-muted-foreground" : "bg-background",
                        isDragging && "opacity-40",
                        a.status === "canceled" && "line-through",
                        !freeing && "cursor-grab active:cursor-grabbing",
                      )}
                      style={{
                        top,
                        height: cardHeight,
                        left: freeing ? "55%" : `calc(${(lane.lane / lane.lanes) * 100}% + 2px)`,
                        width: freeing ? "calc(45% - 4px)" : `calc(${100 / lane.lanes}% - 4px)`,
                        borderLeftColor: color,
                        backgroundColor: freeing ? undefined : `color-mix(in oklab, ${color} 12%, var(--color-background))`,
                      }}
                    >
                      <span className="truncate font-medium">{a.patientName}</span>
                      {cardHeight > 30 ? (
                        <span className="truncate text-muted-foreground">
                          {minutesToTime(a.startMin)} · {a.type ?? statusLabels[a.status]}
                        </span>
                      ) : null}
                      {cardHeight > 48 && a.status !== "scheduled" ? (
                        <span className="mt-auto truncate font-medium" style={{ color: freeing ? undefined : color }}>
                          {statusLabels[a.status]}
                        </span>
                      ) : null}
                    </button>
                  );
                })}

                {/* Prévia ao arrastar */}
                {drag?.moved && drag.colIndex === colIndex ? (
                  <div
                    className="pointer-events-none absolute inset-x-1 z-10 rounded-md border-2 border-dashed border-primary bg-primary/10 px-2 py-1 text-xs font-medium text-primary"
                    style={{
                      top: px(drag.startMin - range.startMin),
                      height: px(drag.appointment.endMin - drag.appointment.startMin),
                    }}
                  >
                    {minutesToTime(drag.startMin)}
                  </div>
                ) : null}

                {/* Agora */}
                {col.isToday && now !== null && now >= range.startMin && now <= range.endMin ? (
                  <div className="pointer-events-none absolute inset-x-0 z-[3] border-t-2 border-destructive" style={{ top: px(now - range.startMin) }}>
                    <span className="absolute -top-1.5 -left-1 size-2.5 rounded-full bg-destructive" />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
