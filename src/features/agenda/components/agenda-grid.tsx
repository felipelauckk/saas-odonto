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
  /** Cor do profissional (forte e suave) para o avatar. */
  color?: { value: string; soft: string };
  initials?: string;
  /** Ocupação do expediente (0–1); nulo sem expediente. */
  occupancy?: number | null;
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
  colorFor: (professionalId: string) => { value: string; soft: string };
  tagColors?: Map<string, string>;
  onSlotClick: (column: GridColumn, startMin: number) => void;
  onAppointmentClick: (appointment: AgendaAppointment) => void;
  onBlockClick: (block: AgendaBlock) => void;
  onMove: (target: MoveTarget) => Promise<boolean>;
};

const px = (minutes: number) => (minutes / 60) * HOUR_HEIGHT;

const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });

/** Texto do estado no cartão (sempre escrito: a cor nunca é o único sinal). */
const CARD_STATUS: Record<AgendaAppointment["status"], string> = {
  scheduled: "Não confirmada",
  confirmed: "Confirmada",
  arrived: "Na espera",
  in_progress: "Em atendimento",
  done: "Concluída",
  no_show: "Faltou",
  canceled: "Desmarcada",
};

/** Aparência do cartão por estado (R4). */
function cardLook(status: AgendaAppointment["status"], color: { value: string; soft: string }) {
  switch (status) {
    case "scheduled":
      return { className: "border-[1.5px] border-dashed border-warning bg-card", style: {}, sub: "text-muted-foreground" };
    case "confirmed":
      return { className: "border-[1.5px]", style: { backgroundColor: color.soft, borderColor: color.value }, sub: "text-muted-foreground" };
    case "arrived":
      return { className: "border-2 border-warning bg-card", style: {}, sub: "text-warning" };
    case "in_progress":
      return { className: "border text-primary-foreground", style: { backgroundColor: color.value, borderColor: color.value }, sub: "text-primary-foreground/85" };
    case "done":
      return { className: "border border-border bg-muted text-muted-foreground", style: {}, sub: "text-muted-foreground" };
    default:
      return {
        className:
          "border border-input bg-[repeating-linear-gradient(135deg,var(--color-background),var(--color-background)_5px,var(--color-card)_5px,var(--color-card)_10px)] text-muted-foreground",
        style: {},
        sub: "text-muted-foreground",
      };
  }
}

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

export function AgendaGrid({ columns, range, colorFor, tagColors, onSlotClick, onAppointmentClick, onBlockClick, onMove }: Props) {
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
    <div className="overflow-auto rounded-card border bg-card" style={{ maxHeight: "calc(100dvh - 15rem)", minHeight: "24rem" }}>
      <div className="relative min-w-full" style={{ width: "max-content" }} ref={gridRef}>
        {/* Cabeçalho */}
        <div className="sticky top-0 z-20 flex border-b bg-card">
          <div className="sticky left-0 z-10 w-14 shrink-0 bg-card" />
          {columns.map((col) => (
            <div
              key={col.key}
              className={cn(
                "flex min-w-40 flex-1 items-center gap-2.5 border-l border-border-soft px-3 py-3 sm:min-w-48",
                col.isToday && "bg-primary/5",
              )}
            >
              {col.color && col.initials ? (
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-bold ring-2 ring-card"
                  style={{ backgroundColor: col.color.soft, color: col.color.value, boxShadow: `0 0 0 3.5px ${col.color.value}` }}
                  aria-hidden
                >
                  {col.initials}
                </span>
              ) : col.color ? (
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: col.color.value }} aria-hidden />
              ) : null}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className={cn("truncate text-sm font-semibold first-letter:uppercase", col.isToday && "text-primary")}>{col.label}</p>
                {col.sublabel ? <p className="truncate text-xs text-muted-foreground">{col.sublabel}</p> : null}
                {/* Dia inteiro: faixa no topo da coluna */}
                {col.blocks.some((b) => b.allDay) ? (
                  <div className="flex flex-col gap-1 pt-0.5">
                    {col.blocks
                      .filter((b) => b.allDay)
                      .map((b) => (
                        <button
                          key={`${b.id}-${b.date}`}
                          type="button"
                          onClick={() => onBlockClick(b)}
                          aria-label={`${b.title}, dia inteiro, ${b.kind === "event" ? "lembrete" : "bloqueado"}`}
                          className={cn(
                            "truncate rounded-md px-2 py-0.5 text-left text-xs font-semibold pointer-coarse:min-h-8",
                            b.kind === "event"
                              ? "border border-dashed border-tint-lilac-foreground/60 bg-tint-lilac/60 text-tint-lilac-foreground"
                              : "border border-muted-foreground/25 bg-[repeating-linear-gradient(135deg,transparent,transparent_5px,var(--color-muted)_5px,var(--color-muted)_10px)] text-muted-foreground",
                          )}
                        >
                          {b.title} · dia inteiro
                        </button>
                      ))}
                  </div>
                ) : null}
                {col.occupancy !== undefined && col.occupancy !== null ? (
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="h-1 w-16 overflow-hidden rounded-full bg-track" aria-hidden>
                      <span className="block h-full rounded-full" style={{ width: `${col.occupancy * 100}%`, backgroundColor: col.color?.value ?? "var(--color-primary)" }} />
                    </span>
                    {pct.format(col.occupancy)} ocupado
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <div className="flex">
          {/* Horas */}
          <div className="sticky left-0 z-10 w-14 shrink-0 bg-card" style={{ height }}>
            {hours.map((m) => (
              <div key={m} className="absolute right-2 -translate-y-1/2 text-xs text-muted-foreground tabular-nums" style={{ top: px(m - range.startMin) }}>
                {m === range.startMin ? null : minutesToTime(m)}
              </div>
            ))}
            {columns.some((c) => c.isToday) && now !== null && now >= range.startMin && now <= range.endMin ? (
              <span
                className="absolute left-1 z-[4] -translate-y-1/2 rounded-[5px] bg-destructive px-1 py-0.5 text-[0.6875rem] font-bold text-card tabular-nums"
                style={{ top: px(now - range.startMin) }}
              >
                <span className="sr-only">Agora, </span>
                {minutesToTime(now)}
              </span>
            ) : null}
          </div>

          {columns.map((col, colIndex) => {
            const lanes = computeLanes(col.appointments.filter((a) => !FREEING_STATUSES.includes(a.status)));
            return (
              <div
                key={col.key}
                data-col-index={colIndex}
                className={cn("relative min-w-40 flex-1 border-l border-border-soft sm:min-w-48", col.isToday && "bg-primary/[0.02]")}
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
                      "absolute inset-x-0 border-t hover:bg-primary/5 focus-visible:bg-primary/10 focus-visible:outline-none",
                      m % 60 !== 0 ? "border-border-soft" : "border-track",
                    )}
                    style={{ top: px(m - range.startMin), height: px(30) }}
                  />
                ))}

                {/* Bloqueios e eventos com horário (dia inteiro fica no cabeçalho; o bloqueio ainda escurece o dia) */}
                {col.blocks.map((b) => {
                  const start = Math.max(b.startMin, range.startMin);
                  const end = Math.min(b.endMin, range.endMin);
                  if (end <= start) return null;
                  const style = { top: px(start - range.startMin), height: px(end - start) };
                  if (b.allDay) {
                    return b.kind === "block" ? (
                      <div
                        key={`${b.id}-${b.date}`}
                        aria-hidden
                        className="pointer-events-none absolute inset-x-0 z-[1] bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,var(--color-muted)_6px,var(--color-muted)_12px)]"
                        style={style}
                      />
                    ) : null;
                  }
                  const time = `${minutesToTime(b.startMin)}–${minutesToTime(b.endMin === 1440 ? 1439 : b.endMin)}`;
                  return b.kind === "event" ? (
                    <button
                      key={`${b.id}-${b.date}`}
                      type="button"
                      onClick={() => onBlockClick(b)}
                      aria-label={`${b.title} · ${time}, lembrete`}
                      className="absolute right-1 left-1 z-[1] overflow-hidden rounded-md border border-dashed border-tint-lilac-foreground/60 bg-tint-lilac/40 px-2 py-0.5 text-left text-xs font-medium text-tint-lilac-foreground"
                      style={style}
                    >
                      {b.title} · {time}
                    </button>
                  ) : (
                    <button
                      key={`${b.id}-${b.date}`}
                      type="button"
                      onClick={() => onBlockClick(b)}
                      aria-label={`${b.title} · ${time}, bloqueado`}
                      className="absolute inset-x-0 z-[1] overflow-hidden border-y border-muted-foreground/20 bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,var(--color-muted)_6px,var(--color-muted)_12px)] px-2 py-1 text-left text-xs text-muted-foreground"
                      style={style}
                    >
                      <span className="rounded bg-background/90 px-1 font-medium">
                        {b.title} · {time}
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
                  const look = cardLook(a.status, color);
                  const top = px(Math.max(startMin, range.startMin) - range.startMin) + 1;
                  const cardHeight = Math.max(px(Math.min(startMin + duration, range.endMin) - Math.max(startMin, range.startMin)) - 2, 22);
                  const tags = a.tagIds.map((id) => tagColors?.get(id)).filter((c): c is string => Boolean(c));
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
                      aria-label={`${a.patientName}, ${minutesToTime(a.startMin)} a ${minutesToTime(a.endMin)}, ${statusLabels[a.status]}${a.isFirstVisit ? ", primeira consulta" : ""}`}
                      className={cn(
                        "absolute z-[2] flex flex-col gap-0.5 overflow-hidden rounded-lg px-2 py-1 text-left text-xs outline-none transition-opacity focus-visible:ring-3 focus-visible:ring-ring/50",
                        look.className,
                        freeing && "z-[1]",
                        isDragging && "opacity-40",
                        !freeing && "cursor-grab active:cursor-grabbing",
                      )}
                      style={{
                        ...look.style,
                        top,
                        height: cardHeight,
                        left: freeing ? "55%" : `calc(${(lane.lane / lane.lanes) * 100}% + 3px)`,
                        width: freeing ? "calc(45% - 6px)" : `calc(${100 / lane.lanes}% - 6px)`,
                      }}
                    >
                      {cardHeight > 40 ? (
                        <span className={cn("flex items-center justify-between gap-1.5 text-[0.6875rem] font-semibold tabular-nums", look.sub)}>
                          <span className="truncate">
                            {minutesToTime(a.startMin)}–{minutesToTime(a.endMin)}
                          </span>
                          <span className="shrink-0">{CARD_STATUS[a.status]}</span>
                        </span>
                      ) : null}
                      <span className={cn("flex items-center gap-1 truncate text-[0.8125rem] font-semibold", freeing && "line-through")}>
                        <span className="truncate">{a.patientName}</span>
                        {tags.map((c, i) => (
                          <span key={i} className="size-2 shrink-0 rounded-full" style={{ backgroundColor: c }} aria-hidden />
                        ))}
                      </span>
                      {cardHeight > 62 && a.type ? <span className={cn("truncate", look.sub)}>{a.type}</span> : null}
                      {cardHeight > 80 && a.isFirstVisit ? (
                        <span className="mt-0.5 self-start rounded-full bg-accent px-1.5 text-[0.6875rem] font-semibold text-accent-foreground">Primeira vez</span>
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
