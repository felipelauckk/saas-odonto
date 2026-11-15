"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Ban, CalendarX2, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cn } from "cn";

import { FormMessage } from "@/components/forms/form-message";
import { SimpleSelect } from "@/components/forms/simple-select";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
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
import type { AgendaAppointment, AgendaBlock, AgendaData } from "../queries";
import { AgendaGrid, type GridColumn, type MoveTarget } from "./agenda-grid";
import { AppointmentDetails } from "./appointment-details";
import { AppointmentForm, type AppointmentFormValues } from "./appointment-form";
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

export function AgendaView({ data, unitId, date, today, view, by, selectedId, isDentist, presetPatient = null }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [dialog, setDialog] = useState<DialogState>(() =>
    presetPatient
      ? {
          kind: "new",
          initial: {
            patient: presetPatient,
            professionalId: data.professionals[0]?.id ?? "",
            chairId: null,
            procedureId: null,
            date: date < today ? today : date,
            time: "09:00",
            durationMin: 30,
            type: "",
            notes: "",
            tagIds: [],
          },
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

  const colorById = useMemo(() => new Map(data.professionals.map((p) => [p.id, p.color])), [data.professionals]);
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
      return days.map((day) => ({
        key: day,
        label: formatShortDay(day),
        date: day,
        professionalId,
        isToday: day === today,
        appointments: appts.filter((a) => a.date === day && a.professionalId === professionalId),
        blocks: blocksFor(day, professionalId),
        working: workingFor(professionalId, day),
      }));
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

    return data.professionals.map((p) => ({
      key: p.id,
      label: p.name,
      color: p.color,
      date,
      professionalId: p.id,
      isToday: date === today,
      appointments: appts.filter((a) => a.date === date && a.professionalId === p.id),
      blocks: blocksFor(date, p.id),
      working: workingFor(p.id, date),
    }));
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
      initial: {
        patient: null,
        professionalId: column?.professionalId ?? (view === "semana" && by === "profissional" ? (selectedId ?? defaultProfessional) : defaultProfessional),
        chairId: column?.chairId ?? null,
        procedureId: null,
        date: column?.date ?? date,
        time: startMin !== undefined ? minutesToTime(startMin) : "09:00",
        durationMin: 30,
        type: "",
        notes: "",
        tagIds: [],
      },
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
      procedureId: a.procedureId,
      date: a.date,
      time: minutesToTime(a.startMin),
      durationMin: Math.round((new Date(a.endsAt).getTime() - new Date(a.startsAt).getTime()) / 60_000),
      type: a.type ?? "",
      notes: a.notes ?? "",
      tagIds: a.tagIds,
    };
  }

  const closeDialog = () => setDialog(null);

  // Cabeçalho -------------------------------------------------------------------------
  const step = view === "semana" ? 7 : 1;
  const title =
    view === "semana"
      ? `${formatShortDay(days[0]!)} – ${formatShortDay(days[6]!)}`
      : formatLongDate(date);

  const segment = (active: boolean) =>
    cn(
      "h-8 rounded-md px-3 text-sm font-medium transition-colors pointer-coarse:h-11",
      active ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
    );

  const weekOptions =
    by === "cadeira"
      ? data.chairs.map((c) => ({ value: c.id, label: c.name }))
      : data.professionals.map((p) => ({ value: p.id, label: p.name }));
  const weekSelected = selectedId ?? weekOptions[0]?.value ?? "";

  const noColumns = columns.length === 0;

  return (
    <div className="space-y-4">
      {/* Barra de ferramentas */}
      <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center">
            <Button variant="ghost" size="icon" aria-label={view === "semana" ? "Semana anterior" : "Dia anterior"} onClick={() => navigate({ data: addDays(date, -step) })}>
              <ChevronLeft />
            </Button>
            <Button variant="ghost" size="icon" aria-label={view === "semana" ? "Próxima semana" : "Próximo dia"} onClick={() => navigate({ data: addDays(date, step) })}>
              <ChevronRight />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate({ data: today })} disabled={days.includes(today)}>
            Hoje
          </Button>
          <h2 className="text-base font-medium first-letter:uppercase">{title}</h2>
          <Input
            type="date"
            aria-label="Ir para a data"
            value={date}
            onChange={(e) => e.target.value && navigate({ data: e.target.value })}
            className="h-8 w-auto pointer-coarse:h-11"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-muted p-1" role="group" aria-label="Período">
            <button type="button" className={segment(view === "dia")} aria-pressed={view === "dia"} onClick={() => navigate({ visao: "dia" })}>
              Dia
            </button>
            <button type="button" className={segment(view === "semana")} aria-pressed={view === "semana"} onClick={() => navigate({ visao: "semana" })}>
              Semana
            </button>
          </div>
          {data.chairs.length ? (
            <div className="inline-flex rounded-lg bg-muted p-1" role="group" aria-label="Ver por">
              <button type="button" className={segment(by === "profissional")} aria-pressed={by === "profissional"} onClick={() => navigate({ por: "profissional", id: null })}>
                Profissional
              </button>
              <button type="button" className={segment(by === "cadeira")} aria-pressed={by === "cadeira"} onClick={() => navigate({ por: "cadeira", id: null })}>
                Cadeira
              </button>
            </div>
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

      {message ? <FormMessage state={{ status: "error", message }} /> : null}
      {notice ? <FormMessage state={{ status: "success", message: notice }} /> : null}

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
          colorFor={(id) => colorById.get(id) ?? "#64748b"}
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
            <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
            Ao vivo ·
          </span>
        ) : null}
        Clique num horário livre para marcar. No computador, arraste a consulta para remarcar.{" "}
        <Link href="/agenda/sala-de-espera" className="underline underline-offset-4 hover:text-foreground">Sala de espera</Link>
        {" · "}
        <Link href="/agenda/espera" className="underline underline-offset-4 hover:text-foreground">Lista de espera</Link>
        {" · "}
        <Link href="/agenda/retornos" className="underline underline-offset-4 hover:text-foreground">Retornos</Link>
        {" · "}
        <Link href="/agenda/faltas" className="underline underline-offset-4 hover:text-foreground">Faltas e desmarcações</Link>
      </p>

      {/* Janelas */}
      <Dialog open={dialog !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          {dialog?.kind === "new" || dialog?.kind === "edit" ? (
            <>
              <DialogHeader>
                <DialogTitle>{dialog.kind === "new" ? "Nova consulta" : "Editar consulta"}</DialogTitle>
              </DialogHeader>
              <AppointmentForm
                key={dialog.kind === "edit" ? dialog.appointment.id : "new"}
                initial={dialog.kind === "edit" ? editValues(dialog.appointment) : dialog.initial}
                professionals={data.professionals}
                chairs={data.chairs}
                procedures={data.procedures}
                tags={data.tags}
                onDone={(text) => {
                  closeDialog();
                  if (text) setNotice(text);
                }}
                onCancel={closeDialog}
              />
            </>
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
