"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Ban, CalendarX2, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cn } from "cn";

import { FormMessage } from "@/components/forms/form-message";
import { SimpleSelect } from "@/components/forms/simple-select";
import { SegmentedControl } from "@/components/app/segmented-control";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  weekdayOf,
} from "@/lib/timezone";

import { deleteBlock, moveAppointment, type PatientOption } from "../actions";
import { visibleRange } from "../layout";
import { initials, occupancy, weekTitle } from "../overview";
import type { AgendaAppointment, AgendaBlock, AgendaData } from "../queries";
import { AgendaGrid, type GridColumn, type MoveTarget } from "./agenda-grid";
import { AppointmentDetails } from "./appointment-details";
import { AppointmentForm, newAppointmentValues, type AppointmentFormValues } from "./appointment-form";
import { procedureKey } from "./appointment-procedures";
import { BlockForm } from "./block-form";

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
  /** Coluna lateral (mini calendário, sala de espera, vaga liberada). */
  aside?: ReactNode;
};

type DialogState =
  | { kind: "new"; initial: AppointmentFormValues }
  | { kind: "details"; appointment: AgendaAppointment }
  | { kind: "edit"; appointment: AgendaAppointment }
  | { kind: "block" }
  | { kind: "blockInfo"; block: AgendaBlock }
  | null;

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

export function AgendaView({ data, unitId, date, today, view, by, selectedId, isDentist, presetPatient = null, subtitle, aside }: Props) {
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

    return data.professionals.map((p) => {
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
  }, [data, view, by, selectedId, date, today, workingFor, tagFilter]);

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
        durationMin: data.procedures.find((x) => x.id === p.procedureId)?.duration_min ?? 30,
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

  return (
    <div className="space-y-4">
      {/* Cabeçalho: a data é o título */}
      <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-end 2xl:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="min-w-0 space-y-1">
            <h1 className="type-display">{title}</h1>
            {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
          <div className="flex items-center gap-2">
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
            <Input
              type="date"
              aria-label="Ir para a data"
              value={date}
              onChange={(e) => e.target.value && navigate({ data: e.target.value })}
              className="h-9 w-auto pointer-coarse:h-11"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
          <Button variant="outline" onClick={() => setDialog({ kind: "block" })} disabled={!data.professionals.length}>
            <Ban aria-hidden />
            Bloquear
          </Button>
          <Button onClick={() => openNew()} disabled={!data.professionals.length}>
            <Plus aria-hidden />
            Nova consulta
          </Button>
        </div>
      </div>

      <AgendaLegend />

      {message ? <FormMessage state={{ status: "error", message }} /> : null}
      {notice ? <FormMessage state={{ status: "success", message: notice }} /> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="min-w-0 space-y-3">
          {noColumns ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-16 text-center">
              <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <CalendarX2 className="size-5" aria-hidden />
              </div>
              {by === "cadeira" ? (
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
              onAppointmentClick={(appointment) => setDialog({ kind: "details", appointment })}
              onBlockClick={(block) => setDialog({ kind: "blockInfo", block })}
              onMove={handleMove}
            />
          )}
          <p className="text-xs text-muted-foreground">
            {live ? (
              <span className="mr-2 inline-flex items-center gap-1.5" data-realtime="on" title="A agenda atualiza sozinha quando alguém marca ou muda uma consulta">
                <span className="size-2 rounded-full bg-success" aria-hidden />
                Ao vivo ·
              </span>
            ) : null}
            Clique num horário livre para marcar. No computador, arraste a consulta para remarcar.
          </p>
        </div>
        {aside ? <aside className="flex min-w-0 flex-col gap-4" aria-label="Resumo da agenda">{aside}</aside> : null}
      </div>

      {/* Janelas */}
      <Dialog open={dialog !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent
          className={cn(
            "max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg",
            // Consulta: cabeçalho, corpo com rolagem própria e rodapé fixo; tela cheia no celular.
            (dialog?.kind === "new" || dialog?.kind === "edit") &&
              "flex flex-col gap-0 overflow-hidden rounded-card p-0 sm:max-w-2xl max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none",
          )}
        >
          {dialog?.kind === "new" || dialog?.kind === "edit" ? (
            <AppointmentForm
              key={dialog.kind === "edit" ? dialog.appointment.id : "new"}
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
            />
          ) : null}

          {dialog?.kind === "details" ? (
            <>
              <DialogHeader className="sr-only">
                <DialogTitle>Consulta de {dialog.appointment.patientName}</DialogTitle>
              </DialogHeader>
              <AppointmentDetails
                appointment={dialog.appointment}
                professionalName={nameById.get(dialog.appointment.professionalId) ?? "Profissional"}
                chairName={dialog.appointment.chairId ? (chairName.get(dialog.appointment.chairId) ?? null) : null}
                procedures={data.procedures}
                unitId={unitId}
                onEdit={() => setDialog({ kind: "edit", appointment: dialog.appointment })}
                onDone={closeDialog}
                canSendReminder={!isDentist}
              />
            </>
          ) : null}

          {dialog?.kind === "block" ? (
            <>
              <DialogHeader>
                <DialogTitle>Bloquear horário</DialogTitle>
                <DialogDescription>Ninguém consegue marcar consulta no período bloqueado.</DialogDescription>
              </DialogHeader>
              <BlockForm
                date={date}
                professionals={data.professionals}
                allowUnitWide={!isDentist}
                onDone={closeDialog}
                onCancel={closeDialog}
              />
            </>
          ) : null}

          {dialog?.kind === "blockInfo" ? (
            <BlockInfo block={dialog.block} professionalName={dialog.block.professionalId ? nameById.get(dialog.block.professionalId) : null} onDone={closeDialog} onError={setMessage} />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BlockInfo({
  block,
  professionalName,
  onDone,
  onError,
}: {
  block: AgendaBlock;
  professionalName: string | null | undefined;
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const [pending, setPending] = useState(false);
  return (
    <>
      <DialogHeader>
        <DialogTitle>{block.reason || "Horário bloqueado"}</DialogTitle>
        <DialogDescription>
          {formatLongDate(block.date)} · {minutesToTime(block.startMin)} às {block.endMin === 1440 ? "24:00" : minutesToTime(block.endMin)} ·{" "}
          {professionalName ?? "Unidade toda"}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Fechar
        </Button>
        <Button
          variant="destructive"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            const result = await deleteBlock(block.id);
            setPending(false);
            if (result.error) onError(result.error);
            onDone();
          }}
        >
          Remover bloqueio
        </Button>
      </DialogFooter>
    </>
  );
}

/** Legenda dos estados da consulta (mesmas classes dos cartões). */
function AgendaLegend() {
  const items = [
    { label: "Não confirmada", className: "border-[1.5px] border-dashed border-warning bg-card" },
    { label: "Confirmada", className: "border-[1.5px] border-primary bg-accent" },
    { label: "Na espera", className: "border-2 border-warning bg-card" },
    { label: "Em atendimento", className: "border border-primary bg-primary" },
    { label: "Concluída", className: "bg-muted" },
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
