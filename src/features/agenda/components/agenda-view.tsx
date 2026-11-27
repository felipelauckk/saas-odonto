"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BellRing, CalendarClock, CalendarPlus, CalendarX2, ChevronDown, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cn } from "cn";

import { FormMessage } from "@/components/forms/form-message";
import { SimpleSelect } from "@/components/forms/simple-select";
import { SegmentedControl } from "@/components/app/segmented-control";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { professionalColor } from "@/lib/professional-colors";
import {
  addDays,
  formatLongDate,
  formatShortDay,
  minutesToTime,
  startOfWeek,
  timeToMinutes,
  utcToZoned,
  weekdayOf,
} from "@/lib/timezone";

import { moveAppointment, type PatientOption } from "../actions";
import { visibleRange } from "../layout";
import { initials, occupancy, weekTitle } from "../overview";
import type { AgendaAppointment, AgendaBlock, AgendaData } from "../queries";
import { AgendaGrid, type GridColumn, type MoveTarget } from "./agenda-grid";
import { AppointmentDetails } from "./appointment-details";
import { AppointmentForm, newAppointmentValues, type AppointmentFormValues } from "./appointment-form";
import { procedureKey } from "./appointment-procedures";
import { CommitmentDetails } from "./commitment-details";
import { CommitmentForm, newCommitmentValues, type CommitmentFormValues } from "./commitment-form";
import type { EntryTab } from "./entry-parts";
import { ReturnAlertForm } from "./return-alert-form";

type View = "dia" | "semana";
type By = "profissional" | "cadeira";

type Props = {
  data: AgendaData;
  unitId: string;
  date: string;
  today: string;
  view: View;
  by: By;
  selectedId: string | null;
  isDentist: boolean;
  /** Abre "Nova consulta" já com o paciente (vindo da CRC ou da ficha). */
  presetPatient?: PatientOption | null;
  /** Linha abaixo do título (unidade ou "Sua agenda"). */
  subtitle?: string;
  /** Mini calendário (topo da coluna lateral). */
  calendar?: ReactNode;
  /** Resto da coluna lateral (alertas de retorno, sala de espera, vaga liberada). */
  aside?: ReactNode;
};

type DialogState =
  | { kind: "new"; initial: AppointmentFormValues }
  | { kind: "details"; appointment: AgendaAppointment; anchor: CardAnchor | null }
  | { kind: "edit"; appointment: AgendaAppointment; focus?: "slots" }
  | { kind: "commitment"; initial: CommitmentFormValues }
  | { kind: "blockInfo"; block: AgendaBlock }
  | { kind: "returnAlert" }
  | null;

type CardAnchor = { top: number; left: number; right: number };

const CARD_WIDTH = 440;

/**
 * Cartão da consulta ao lado do cartão clicado (à direita; se não couber, à
 * esquerda). Só no computador: no celular vira folha de baixo para cima.
 */
function cardPosition(anchor: CardAnchor | null): React.CSSProperties | undefined {
  if (!anchor || typeof window === "undefined" || window.innerWidth < 640) return undefined;
  const gap = 8;
  const vw = window.innerWidth;
  const fitsRight = anchor.right + gap + CARD_WIDTH <= vw - 16;
  const fitsLeft = anchor.left - gap - CARD_WIDTH >= 16;
  // Coluna larga (um profissional só): não cabe ao lado; vai para a borda mais longe do meio da consulta.
  const left = fitsRight ? anchor.right + gap : fitsLeft ? anchor.left - gap - CARD_WIDTH : (anchor.left + anchor.right) / 2 > vw / 2 ? 16 : vw - 16 - CARD_WIDTH;
  const top = Math.min(Math.max(anchor.top - 24, 16), Math.max(16, window.innerHeight - 640));
  // O centro do diálogo vem da propriedade `translate` (Tailwind 4): zerada aqui.
  return { left, top, translate: "none", maxHeight: `calc(100dvh - ${top + 16}px)` };
}

/** Atualiza a tela quando outra pessoa mexe na agenda da unidade. */
function useAgendaRealtime(unitId: string) {
  const router = useRouter();
  const [live, setLive] = useState(false);
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 300);
    };

    // O canal precisa do token do usuário: sem ele, a RLS esconde todos os eventos.
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled || !data.session) return;
      void supabase.realtime.setAuth(data.session.access_token);
      channel = supabase
        .channel(`agenda-${unitId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "appointments", filter: `unit_id=eq.${unitId}` }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "schedule_blocks", filter: `unit_id=eq.${unitId}` }, refresh)
        // "Ao vivo" só depois que o banco confirma a assinatura das mudanças
        // (o SUBSCRIBED do canal chega antes disso).
        .on("system", {}, (payload: { extension?: string; status?: string }) => {
          if (!cancelled && payload.extension === "postgres_changes") setLive(payload.status === "ok");
        })
        .subscribe((status) => {
          if (!cancelled && status !== "SUBSCRIBED") setLive(false);
        });
    });

    // Rede de segurança: ao voltar para a aba, busca de novo (eventos perdidos com a aba em segundo plano).
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      setLive(false);
      document.removeEventListener("visibilitychange", onVisible);
      clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [unitId, router]);
  return live;
}

export function AgendaView({ data, unitId, date, today, view, by, selectedId, isDentist, presetPatient = null, subtitle, calendar, aside }: Props) {
  const [hiddenPros, setHidden] = useHiddenProfessionals(unitId);
  const router = useRouter();
  const pathname = usePathname();
  const [dialog, setDialog] = useState<DialogState>(() =>
    presetPatient
      ? {
          kind: "new",
          initial: newAppointmentValues({ patient: presetPatient, professionalId: data.professionals[0]?.id ?? "", date: date < today ? today : date }),
        }
      : null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string>("all");
  const live = useAgendaRealtime(unitId);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 6000);
    return () => clearTimeout(timer);
  }, [message]);

  const navigate = useCallback(
    (changes: Partial<{ data: string; visao: View; por: By; id: string | null }>) => {
      const next = { data: date, visao: view, por: by, id: selectedId, ...changes };
      const qs = new URLSearchParams();
      if (next.data !== today) qs.set("data", next.data);
      if (next.visao !== "dia") qs.set("visao", next.visao);
      if (next.por !== "profissional") qs.set("por", next.por);
      if (next.id && next.visao === "semana") qs.set("id", next.id);
      const s = qs.toString();
      router.push(s ? `${pathname}?${s}` : pathname);
    },
    [date, view, by, selectedId, today, pathname, router],
  );

  const colorById = useMemo(() => new Map(data.professionals.map((p) => [p.id, professionalColor(p.color)])), [data.professionals]);
  const nameById = useMemo(() => new Map(data.professionals.map((p) => [p.id, p.name])), [data.professionals]);
  const chairName = useMemo(() => new Map(data.chairs.map((c) => [c.id, c.name])), [data.chairs]);

  const workingFor = useCallback(
    (professionalId: string, day: string) =>
      data.schedules
        .filter((s) => s.professional_id === professionalId && s.weekday === weekdayOf(day))
        .map((s) => ({ startMin: timeToMinutes(s.start_time), endMin: timeToMinutes(s.end_time) })),
    [data.schedules],
  );

  // Colunas -----------------------------------------------------------------------
  const weekStart = startOfWeek(date);
  const days = view === "semana" ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)) : [date];

  const columns: GridColumn[] = useMemo(() => {
    const appts = tagFilter === "all" ? data.appointments : data.appointments.filter((a) => a.tagIds.includes(tagFilter));
    const blocksFor = (day: string, professionalId: string | null) =>
      data.blocks.filter((b) => b.date === day && (b.professionalId === null || b.professionalId === professionalId));

    if (view === "semana") {
      if (by === "cadeira") {
        const chairId = selectedId ?? data.chairs[0]?.id;
        if (!chairId) return [];
        return days.map((day) => ({
          key: day,
          label: formatShortDay(day),
          date: day,
          professionalId: null,
          chairId,
          isToday: day === today,
          appointments: appts.filter((a) => a.date === day && a.chairId === chairId),
          blocks: blocksFor(day, null),
          working: null,
        }));
      }
      const professionalId = selectedId ?? data.professionals[0]?.id;
      if (!professionalId) return [];
      return days.map((day) => {
        const dayAppts = appts.filter((a) => a.date === day && a.professionalId === professionalId);
        const working = workingFor(professionalId, day);
        return {
          key: day,
          label: formatShortDay(day),
          color: professionalColor(data.professionals.find((p) => p.id === professionalId)?.color ?? null),
          date: day,
          professionalId,
          isToday: day === today,
          appointments: dayAppts,
          blocks: blocksFor(day, professionalId),
          working,
          occupancy: occupancy(dayAppts, working),
        };
      });
    }

    if (by === "cadeira") {
      const dayAppts = appts.filter((a) => a.date === date);
      const cols: GridColumn[] = data.chairs.map((c) => ({
        key: c.id,
        label: c.name,
        date,
        professionalId: null,
        chairId: c.id,
        isToday: date === today,
        appointments: dayAppts.filter((a) => a.chairId === c.id),
        blocks: blocksFor(date, null),
        working: null,
      }));
      const withoutChair = dayAppts.filter((a) => !a.chairId);
      if (withoutChair.length) {
        cols.push({
          key: "sem-cadeira",
          label: "Sem cadeira",
          date,
          professionalId: null,
          chairId: null,
          isToday: date === today,
          appointments: withoutChair,
          blocks: blocksFor(date, null),
          working: null,
        });
      }
      return cols;
    }

    return data.professionals.filter((p) => !hiddenPros.includes(p.id)).map((p) => {
      const dayAppts = appts.filter((a) => a.date === date && a.professionalId === p.id);
      const working = workingFor(p.id, date);
      return {
        key: p.id,
        label: p.name,
        color: professionalColor(p.color),
        initials: initials(p.name),
        date,
        professionalId: p.id,
        isToday: date === today,
        appointments: dayAppts,
        blocks: blocksFor(date, p.id),
        working,
        occupancy: occupancy(dayAppts, working),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, view, by, selectedId, date, today, workingFor, tagFilter, hiddenPros]);

  const range = useMemo(
    () =>
      visibleRange([
        ...columns.flatMap((c) => c.working ?? []),
        ...columns.flatMap((c) => c.appointments),
        ...columns.flatMap((c) => c.blocks).filter((b) => b.endMin - b.startMin < 24 * 60),
      ]),
    [columns],
  );

  // Ações ---------------------------------------------------------------------------
  const defaultProfessional = data.professionals[0]?.id ?? "";

  function openNew(column?: GridColumn, startMin?: number) {
    setDialog({
      kind: "new",
      initial: newAppointmentValues({
        professionalId: column?.professionalId ?? (view === "semana" && by === "profissional" ? (selectedId ?? defaultProfessional) : defaultProfessional),
        chairId: column?.chairId ?? null,
        date: column?.date ?? date,
        // Clique na grade: o horário clicado já vem escolhido.
        time: startMin !== undefined ? minutesToTime(startMin) : null,
      }),
    });
  }

  /** Novo compromisso: mesmo dia e profissional da consulta (ou da coluna), horário clicado já como início. */
  function openCommitment(from?: { professionalId?: string; date?: string; startMin?: number | null }) {
    setDialog({
      kind: "commitment",
      initial: newCommitmentValues({
        professionalId: from?.professionalId || (view === "semana" && by === "profissional" ? (selectedId ?? defaultProfessional) : defaultProfessional),
        date: from?.date ?? date,
        startMin: from?.startMin ?? null,
      }),
    });
  }

  /** Aba do diálogo: troca entre consulta e compromisso levando dia, profissional e horário. */
  function switchTab(tab: EntryTab, from: { professionalId: string; date: string; startMin: number | null }) {
    if (tab === "compromisso") openCommitment(from);
    else
      setDialog({
        kind: "new",
        initial: newAppointmentValues({ professionalId: from.professionalId, date: from.date, time: from.startMin === null ? null : minutesToTime(from.startMin) }),
      });
  }

  function commitmentValues(b: AgendaBlock): CommitmentFormValues {
    const start = utcToZoned(b.startsAt);
    const end = utcToZoned(b.endsAt);
    return {
      id: b.id,
      seriesId: b.seriesId,
      title: b.title,
      notes: b.notes ?? "",
      target: b.professionalId ? "professional" : "clinic",
      professionalId: b.professionalId ?? defaultProfessional,
      kind: b.kind,
      date: start.date,
      allDay: b.allDay,
      startMin: b.allDay ? null : start.minutes,
      endMin: b.allDay ? null : end.date === start.date ? end.minutes : 24 * 60,
    };
  }

  async function handleMove({ appointment, column, startMin }: MoveTarget) {
    const result = await moveAppointment({
      id: appointment.id,
      date: column.date,
      time: minutesToTime(startMin),
      professionalId: column.professionalId ?? undefined,
      chairId: column.chairId === undefined ? undefined : column.chairId,
    });
    if (result.error) {
      setMessage(result.error);
      return false;
    }
    return true;
  }

  function editValues(a: AgendaAppointment): AppointmentFormValues {
    return {
      id: a.id,
      patient: { id: a.patientId, name: a.patientName, detail: a.patientPhone },
      professionalId: a.professionalId,
      chairId: a.chairId,
      procedures: a.procedures.map((p) => ({
        key: procedureKey(),
        procedureId: p.procedureId,
        name: p.name,
        // Item escrito à mão não tem duração cadastrada.
        durationMin: data.procedures.find((x) => x.id === p.procedureId)?.duration_min ?? 0,
        treatmentItemId: p.treatmentItemId,
        tooth: p.tooth,
        faces: p.faces,
      })),
      date: a.date,
      time: minutesToTime(a.startMin),
      durationMin: Math.round((new Date(a.endsAt).getTime() - new Date(a.startsAt).getTime()) / 60_000),
      type: a.type ?? "",
      notes: a.notes ?? "",
      tagIds: a.tagIds,
      confirmationMode: a.confirmationMode,
      reminderMode: a.reminderMode,
    };
  }

  const closeDialog = () => setDialog(null);

  // Cabeçalho -------------------------------------------------------------------------
  const step = view === "semana" ? 7 : 1;
  const title = view === "semana" ? weekTitle(days[0]!, days[6]!) : formatLongDate(date).replace(/^./, (c) => c.toUpperCase());

  const weekOptions =
    by === "cadeira"
      ? data.chairs.map((c) => ({ value: c.id, label: c.name }))
      : data.professionals.map((p) => ({ value: p.id, label: p.name }));
  const weekSelected = selectedId ?? weekOptions[0]?.value ?? "";

  const noColumns = columns.length === 0;
  const allHidden = by === "profissional" && view === "dia" && data.professionals.length > 0 && data.professionals.every((p) => hiddenPros.includes(p.id));

  const newMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" disabled={!data.professionals.length} />}>
        <Plus aria-hidden />
        Novo
        <ChevronDown aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-52">
        <DropdownMenuItem className="pointer-coarse:min-h-11" onClick={() => openNew()}>
          <CalendarPlus aria-hidden />
          Nova consulta
        </DropdownMenuItem>
        <DropdownMenuItem className="pointer-coarse:min-h-11" onClick={() => openCommitment()}>
          <CalendarClock aria-hidden />
          Novo compromisso
        </DropdownMenuItem>
        <DropdownMenuItem className="pointer-coarse:min-h-11" onClick={() => setDialog({ kind: "returnAlert" })}>
          <BellRing aria-hidden />
          Alerta de retorno
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
  const newButtons = (
    <div className="flex gap-2">
      <Button onClick={() => openNew()} disabled={!data.professionals.length} className="flex-1">
        <Plus aria-hidden />
        Nova consulta
      </Button>
      {newMenu}
    </div>
  );

  return (
    // data-agenda-wide: o layout do app solta a largura máxima nesta tela.
    <div data-agenda-wide className="grid gap-5 xl:grid-cols-[16.5rem_minmax(0,1fr)]">
      {/* Coluna lateral (à esquerda no computador) */}
      <aside className="order-last flex min-w-0 flex-col gap-4 xl:order-first" aria-label="Resumo da agenda">
        <div className="hidden xl:block">{newButtons}</div>
        {calendar}
        {by === "profissional" && view === "dia" && data.professionals.length > 1 ? (
          <ProfessionalFilter professionals={data.professionals} hidden={hiddenPros} onChange={setHidden} />
        ) : null}
        {aside}
      </aside>

      <div className="min-w-0 space-y-3">
        {/* Barra do topo: navegação, data e visões */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex items-center overflow-hidden rounded-lg border border-input bg-card">
            <button
              type="button"
              aria-label={view === "semana" ? "Semana anterior" : "Dia anterior"}
              onClick={() => navigate({ data: addDays(date, -step) })}
              className="flex size-9 items-center justify-center hover:bg-muted pointer-coarse:size-11"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => navigate({ data: today })}
              disabled={days.includes(today)}
              className="h-9 border-x border-border px-3 text-[0.8125rem] font-semibold hover:bg-muted disabled:text-muted-foreground disabled:hover:bg-transparent pointer-coarse:h-11"
            >
              Hoje
            </button>
            <button
              type="button"
              aria-label={view === "semana" ? "Próxima semana" : "Próximo dia"}
              onClick={() => navigate({ data: addDays(date, step) })}
              className="flex size-9 items-center justify-center hover:bg-muted pointer-coarse:size-11"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-black tracking-tight sm:text-2xl">{title}</h1>
            {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
          </div>
          <Input
            type="date"
            aria-label="Ir para a data"
            value={date}
            onChange={(e) => e.target.value && navigate({ data: e.target.value })}
            className="h-9 w-auto pointer-coarse:h-11"
          />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <SegmentedControl
              label="Período"
              value={view}
              onChange={(v) => navigate({ visao: v })}
              options={[
                { value: "dia", label: "Dia" },
                { value: "semana", label: "Semana" },
              ]}
            />
            {data.chairs.length ? (
              <SegmentedControl
                label="Ver por"
                value={by}
                onChange={(v) => navigate({ por: v, id: null })}
                options={[
                  { value: "profissional", label: "Profissional" },
                  { value: "cadeira", label: "Cadeira" },
                ]}
              />
            ) : null}
            {view === "semana" && weekOptions.length > 1 ? (
              <SimpleSelect
                id="agenda-week-target"
                aria-label={by === "cadeira" ? "Cadeira" : "Profissional"}
                value={weekSelected}
                onChange={(v) => navigate({ id: v })}
                options={weekOptions}
                className="w-48 data-[size=default]:h-10 pointer-coarse:data-[size=default]:h-11"
              />
            ) : null}
            {data.tags.length ? (
              <SimpleSelect
                id="agenda-tag-filter"
                aria-label="Filtrar por marcador"
                value={tagFilter}
                onChange={setTagFilter}
                options={[{ value: "all", label: "Todos os marcadores" }, ...data.tags.map((t) => ({ value: t.id, label: t.name }))]}
                className="w-48 data-[size=default]:h-10 pointer-coarse:data-[size=default]:h-11"
              />
            ) : null}
            <div className="xl:hidden">{newButtons}</div>
          </div>
        </div>

        {message ? <FormMessage state={{ status: "error", message }} /> : null}
        {notice ? <FormMessage state={{ status: "success", message: notice }} /> : null}

        {noColumns ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-16 text-center">
            <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <CalendarX2 className="size-5" aria-hidden />
            </div>
            {allHidden ? (
              <>
                <h2 className="text-base font-medium">Nenhum profissional selecionado</h2>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">Marque ao menos um profissional na lista ao lado.</p>
              </>
            ) : by === "cadeira" ? (
              <>
                <h2 className="text-base font-medium">Nenhuma cadeira nesta unidade</h2>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">Cadastre as cadeiras para ver a agenda por cadeira.</p>
              </>
            ) : isDentist ? (
              <>
                <h2 className="text-base font-medium">Sua agenda ainda não está configurada</h2>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Peça ao gestor da clínica para ligar o seu usuário a um profissional em Configurações → Profissionais.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-base font-medium">Nenhum profissional cadastrado</h2>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">Cadastre os dentistas e os horários de atendimento para usar a agenda.</p>
                <Link href="/configuracoes/profissionais" className={cn(buttonVariants(), "mt-6")}>
                  Cadastrar profissionais
                </Link>
              </>
            )}
          </div>
        ) : (
          <AgendaGrid
            columns={columns}
            range={range}
            colorFor={(id) => colorById.get(id) ?? professionalColor(null)}
            tagColors={new Map(data.tags.map((t) => [t.id, t.color]))}
            onSlotClick={openNew}
            onAppointmentClick={(appointment, rect) =>
              setDialog({ kind: "details", appointment, anchor: rect ? { top: rect.top, left: rect.left, right: rect.right } : null })
            }
            onBlockClick={(block) => setDialog({ kind: "blockInfo", block })}
            onMove={handleMove}
          />
        )}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="text-xs text-muted-foreground">
            {live ? (
              <span className="mr-2 inline-flex items-center gap-1.5" data-realtime="on" title="A agenda atualiza sozinha quando alguém marca ou muda uma consulta">
                <span className="size-2 rounded-full bg-success" aria-hidden />
                Ao vivo ·
              </span>
            ) : null}
            Clique num horário livre para marcar. No computador, arraste a consulta para remarcar.
          </p>
          <AgendaLegend />
        </div>
      </div>

      {/* Janelas */}
      <Dialog open={dialog !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent
          style={dialog?.kind === "details" ? cardPosition(dialog.anchor) : undefined}
          className={cn(
            "max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg",
            // Cartão da consulta: 440px ao lado da consulta; no celular, folha de baixo.
            dialog?.kind === "details" &&
              "flex flex-col gap-0 overflow-hidden rounded-card p-0 sm:w-[440px] sm:max-w-[440px] max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:max-h-[88dvh] max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none",
            // Consulta: cabeçalho, corpo com rolagem própria e rodapé fixo; tela cheia no celular.
            (dialog?.kind === "new" || dialog?.kind === "edit" || dialog?.kind === "commitment") &&
              "flex flex-col gap-0 overflow-hidden rounded-card p-0 sm:max-w-2xl max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none",
          )}
        >
          {dialog?.kind === "new" || dialog?.kind === "edit" ? (
            <AppointmentForm
              key={dialog.kind === "edit" ? dialog.appointment.id : "new"}
              focusSlots={dialog.kind === "edit" && dialog.focus === "slots"}
              initial={dialog.kind === "edit" ? editValues(dialog.appointment) : dialog.initial}
              professionals={data.professionals}
              chairs={data.chairs}
              procedures={data.procedures}
              tags={data.tags}
              today={today}
              isDentist={isDentist}
              onDone={(text) => {
                closeDialog();
                if (text) setNotice(text);
              }}
              onCancel={closeDialog}
              onSwitchTab={
                dialog.kind === "new"
                  ? (tab) => switchTab(tab, { professionalId: dialog.initial.professionalId, date: dialog.initial.date, startMin: dialog.initial.time ? timeToMinutes(dialog.initial.time) : null })
                  : undefined
              }
            />
          ) : null}

          {dialog?.kind === "details" ? (
            <AppointmentDetails
              appointment={dialog.appointment}
              professionalName={nameById.get(dialog.appointment.professionalId) ?? "Profissional"}
              professionalColor={colorById.get(dialog.appointment.professionalId)?.value ?? "var(--color-primary)"}
              chairName={dialog.appointment.chairId ? (chairName.get(dialog.appointment.chairId) ?? null) : null}
              tags={data.tags}
              isDentist={isDentist}
              procedures={data.procedures}
              onEdit={(focus) => setDialog({ kind: "edit", appointment: dialog.appointment, focus })}
              onDone={(text) => {
                closeDialog();
                if (text) setNotice(text);
              }}
              canSendReminder={!isDentist}
            />
          ) : null}

          {dialog?.kind === "commitment" ? (
            <CommitmentForm
              key={dialog.initial.id ?? "new"}
              initial={dialog.initial}
              professionals={data.professionals}
              schedules={data.schedules}
              isDentist={isDentist}
              onDone={(text) => {
                closeDialog();
                if (text) setNotice(text);
              }}
              onCancel={closeDialog}
              onSwitchTab={(tab) => switchTab(tab, { professionalId: dialog.initial.professionalId, date: dialog.initial.date, startMin: dialog.initial.startMin })}
            />
          ) : null}

          {dialog?.kind === "blockInfo" ? (
            <CommitmentDetails
              block={dialog.block}
              professionalName={dialog.block.professionalId ? (nameById.get(dialog.block.professionalId) ?? "Profissional") : null}
              canEdit={!isDentist || dialog.block.professionalId !== null}
              onEdit={() => setDialog({ kind: "commitment", initial: commitmentValues(dialog.block) })}
              onDone={(text) => {
                closeDialog();
                if (text) setNotice(text);
              }}
            />
          ) : null}

          {dialog?.kind === "returnAlert" ? (
            <ReturnAlertForm
              professionals={data.professionals}
              onDone={(text) => {
                closeDialog();
                if (text) setNotice(text);
              }}
              onCancel={closeDialog}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Legenda dos estados da consulta (mesmas classes dos cartões). */
function AgendaLegend() {
  const items = [
    { label: "Não confirmada", className: "border border-dashed border-primary/60 border-l-[3px] border-l-primary bg-accent" },
    { label: "Confirmada", className: "border-l-[3px] border-l-primary bg-accent" },
    { label: "Na espera", className: "border-l-[3px] border-l-primary bg-accent ring-2 ring-warning ring-inset" },
    { label: "Em atendimento", className: "bg-primary" },
    { label: "Atendida", className: "border-l-[3px] border-l-muted-foreground/40 bg-muted" },
    {
      label: "Faltou ou desmarcou",
      className:
        "border border-input bg-[repeating-linear-gradient(135deg,var(--color-muted),var(--color-muted)_3px,var(--color-card)_3px,var(--color-card)_6px)]",
    },
  ];
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground" aria-label="Legenda dos estados">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className={cn("h-3 w-4 rounded-[3px]", i.className)} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

const HIDDEN_KEY = (unitId: string) => `agenda:profissionais-ocultos:${unitId}`;

/** Profissionais escondidos na visão do dia, lembrados neste navegador (sem quebrar se o armazenamento falhar). */
function useHiddenProfessionals(unitId: string): [string[], (ids: string[]) => void] {
  const [hidden, setHidden] = useState<string[]>([]);
  useEffect(() => {
    let saved: string[] = [];
    try {
      const raw = window.localStorage.getItem(HIDDEN_KEY(unitId));
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) saved = parsed.filter((x): x is string => typeof x === "string");
    } catch {
      saved = [];
    }
    const t = setTimeout(() => setHidden(saved), 0);
    return () => clearTimeout(t);
  }, [unitId]);
  const update = useCallback(
    (ids: string[]) => {
      setHidden(ids);
      try {
        window.localStorage.setItem(HIDDEN_KEY(unitId), JSON.stringify(ids));
      } catch {
        // Sem armazenamento (navegação privada): vale só nesta tela.
      }
    },
    [unitId],
  );
  return [hidden, update];
}

/** Lista de profissionais com caixa de marcar e a cor de cada um. */
function ProfessionalFilter({
  professionals,
  hidden,
  onChange,
}: {
  professionals: { id: string; name: string; color: string }[];
  hidden: string[];
  onChange: (ids: string[]) => void;
}) {
  const allShown = hidden.length === 0;
  return (
    <section aria-labelledby="agenda-pros" className="rounded-card border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between gap-2 pb-2">
        <h2 id="agenda-pros" className="type-section">
          Profissionais
        </h2>
        <button
          type="button"
          onClick={() => onChange(allShown ? professionals.map((p) => p.id) : [])}
          className="text-xs font-semibold text-primary hover:underline pointer-coarse:min-h-11"
        >
          {allShown ? "Nenhum" : "Todos"}
        </button>
      </div>
      <ul className="space-y-0.5">
        {professionals.map((p) => {
          const shown = !hidden.includes(p.id);
          const color = professionalColor(p.color).value;
          return (
            <li key={p.id}>
              <label className="flex min-h-8 cursor-pointer items-center gap-2.5 rounded-md px-1 text-[0.8125rem] hover:bg-muted pointer-coarse:min-h-11">
                <input
                  type="checkbox"
                  checked={shown}
                  onChange={() => onChange(shown ? [...hidden, p.id] : hidden.filter((x) => x !== p.id))}
                  className="size-4 rounded"
                  style={{ accentColor: color }}
                />
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
                <span className="truncate">{p.name}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
