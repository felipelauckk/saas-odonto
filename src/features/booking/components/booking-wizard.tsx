"use client";

import { useEffect, useState, useTransition } from "react";
import { CalendarCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "cn";

import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addDays, formatLongDate, weekdayOf } from "@/lib/timezone";

import type { BookingPage } from "../service";
import type { Slot } from "../slots";

type Actions = {
  getSlots: (input: { slug: string; unitId: string; professionalId: string | null; procedureId: string | null; from: string }) => Promise<Slot[] | null>;
  startBooking: (input: { slug: string; unitId: string; professionalId: string | null; procedureId: string | null; startsAt: string; name: string; phone: string }) => Promise<{ error?: string; requestId?: string; devCode?: string }>;
  finishBooking: (input: { slug: string; requestId: string; code: string }) => Promise<{ error?: string; when?: string; professionalName?: string; unitName?: string }>;
};

const select = "h-11 w-full rounded-lg border border-input bg-card px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";
const WEEKDAY = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const PERIODS = [
  { label: "Manhã", test: (t: string) => t < "12:00" },
  { label: "Tarde", test: (t: string) => t >= "12:00" && t < "18:00" },
  { label: "Noite", test: (t: string) => t >= "18:00" },
];
const dm = (date: string) => date.slice(8, 10) + "/" + date.slice(5, 7);

/** Etapas visíveis: 1 horário, 2 seus dados, 3 confirmar. */
function Steps({ current }: { current: 1 | 2 | 3 }) {
  const steps = ["Horário", "Seus dados", "Confirmar"];
  return (
    <ol className="flex items-center gap-2 text-xs font-semibold" aria-label="Etapas do agendamento">
      {steps.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        return (
          <li key={label} aria-current={n === current ? "step" : undefined} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full tabular-nums",
                n < current ? "bg-primary text-primary-foreground" : n === current ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
              )}
            >
              {n}
            </span>
            <span className={cn("truncate", n === current ? "text-foreground" : "text-muted-foreground")}>{label}</span>
            {n < 3 ? <span aria-hidden className="h-px flex-1 bg-border" /> : null}
          </li>
        );
      })}
    </ol>
  );
}

export function BookingWizard({ page, today, actions }: { page: BookingPage; today: string; actions: Actions }) {
  const [unitId, setUnitId] = useState(page.units[0]?.id ?? "");
  const [procedureId, setProcedureId] = useState<string>(page.procedures[0]?.id ?? "");
  const [professionalId, setProfessionalId] = useState<string>("");
  const [from, setFrom] = useState(today);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [chosen, setChosen] = useState<Slot | null>(null);
  const [picked, setPicked] = useState<Slot | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [request, setRequest] = useState<{ id: string; devCode?: string } | null>(null);
  const [code, setCode] = useState("");
  const [done, setDone] = useState<{ when?: string; professionalName?: string; unitName?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const lastDay = addDays(today, page.maxDaysAhead);

  useEffect(() => {
    let alive = true;
    actions
      .getSlots({ slug: page.slug, unitId, professionalId: professionalId || null, procedureId: procedureId || null, from })
      .then((list) => {
        if (alive) setSlots(list ?? []);
      });
    return () => {
      alive = false;
    };
  }, [actions, page.slug, unitId, professionalId, procedureId, from]);

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-card border bg-card p-8 text-center">
        <CalendarCheck className="size-10 text-success" aria-hidden />
        <h2 className="type-title">Consulta marcada!</h2>
        <p className="text-sm text-muted-foreground">
          {done.when}
          {done.professionalName ? ` com ${done.professionalName}` : ""}
          {page.units.length > 1 && done.unitName ? ` · ${done.unitName}` : ""}. Você vai receber um lembrete no WhatsApp na véspera.
        </p>
      </div>
    );
  }

  const byDay = new Map<string, Slot[]>();
  for (const s of slots ?? []) byDay.set(s.date, [...(byDay.get(s.date) ?? []), s]);
  const proName = (id: string) => page.professionals.find((p) => p.id === id)?.name;
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const activeDay = day && byDay.has(day) ? day : (weekDays.find((d) => byDay.has(d)) ?? null);

  return (
    <div className="space-y-6">
      {error ? <FormMessage state={{ status: "error", message: error }} /> : null}

      {!chosen ? (
        <>
          <Steps current={1} />
          <div className="grid gap-4 sm:grid-cols-2">
            {page.units.length > 1 ? (
              <div className="space-y-1.5">
                <Label htmlFor="bk-unit">Unidade</Label>
                <select id="bk-unit" className={select} value={unitId} onChange={(e) => setUnitId(e.target.value)}>
                  {page.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            ) : null}
            {page.procedures.length ? (
              <div className="space-y-1.5">
                <Label htmlFor="bk-type">Tipo de consulta</Label>
                <select id="bk-type" className={select} value={procedureId} onChange={(e) => setProcedureId(e.target.value)}>
                  {page.procedures.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="bk-pro">Profissional</Label>
              <select id="bk-pro" className={select} value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
                <option value="">Qualquer profissional</option>
                {page.professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Button variant="outline" size="icon" aria-label="Semana anterior" disabled={from <= today} onClick={() => { setFrom(from <= addDays(today, 7) ? today : addDays(from, -7)); setDay(null); setPicked(null); }}>
                <ChevronLeft />
              </Button>
              <p className="text-sm font-semibold">A partir de {from.split("-").reverse().join("/")}</p>
              <Button variant="outline" size="icon" aria-label="Próxima semana" disabled={addDays(from, 7) > lastDay} onClick={() => { setFrom(addDays(from, 7)); setDay(null); setPicked(null); }}>
                <ChevronRight />
              </Button>
            </div>
            <div role="group" aria-label="Dia" className="grid grid-cols-7 gap-1.5">
              {weekDays.map((d) => {
                const has = byDay.has(d);
                const on = d === activeDay;
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={!has}
                    aria-pressed={on}
                    aria-label={`${formatLongDate(d)}${has ? "" : ", sem horários"}`}
                    onClick={() => { setDay(d); setPicked(null); }}
                    className={cn(
                      "flex h-16 flex-col items-center justify-center rounded-xl border text-xs transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-40",
                      on ? "border-foreground bg-foreground font-semibold text-background" : "border-border bg-card hover:border-primary",
                    )}
                  >
                    <span className={on ? "" : "text-muted-foreground"}>{WEEKDAY[weekdayOf(d)]}</span>
                    <span className="text-lg font-bold tabular-nums">{Number(d.slice(8, 10))}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {slots === null ? (
            <p className="text-sm text-muted-foreground" role="status">Carregando horários...</p>
          ) : activeDay ? (
            <section aria-label={`Horários livres ${formatLongDate(activeDay)}`} className="space-y-4">
              <h2 className="text-sm font-semibold first-letter:uppercase">Horários livres · {formatLongDate(activeDay)}</h2>
              {PERIODS.map((period) => {
                const list = (byDay.get(activeDay) ?? []).filter((sl) => period.test(sl.time));
                if (!list.length) return null;
                return (
                  <div key={period.label} className="space-y-2">
                    <h3 className="type-label text-muted-foreground">{period.label}</h3>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {list.map((sl) => {
                        const on = picked?.startsAt === sl.startsAt && picked.professionalId === sl.professionalId;
                        return (
                          <button
                            key={`${sl.startsAt}-${sl.professionalId}`}
                            type="button"
                            aria-pressed={on}
                            onClick={() => setPicked(sl)}
                            className={cn(
                              "h-12 rounded-lg border text-sm font-semibold tabular-nums transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                              on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:border-primary",
                            )}
                          >
                            {sl.time}
                            {professionalId ? "" : <span className="sr-only"> com {proName(sl.professionalId)}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </section>
          ) : (
            <p className="rounded-xl border border-dashed px-6 py-8 text-center text-sm text-muted-foreground">Nenhum horário livre nesta semana. Veja a próxima.</p>
          )}

          {picked ? (
            <div className="sticky bottom-0 -mx-4 border-t border-border-soft bg-background/95 px-4 py-3 backdrop-blur">
              <Button className="h-12 w-full text-[0.9375rem]" onClick={() => setChosen(picked)}>
                Continuar · {WEEKDAY[weekdayOf(picked.date)]}, {dm(picked.date)} às {picked.time}
              </Button>
            </div>
          ) : null}
        </>
      ) : !request ? (
        <div className="space-y-4">
          <Steps current={2} />
          <div className="flex items-start justify-between gap-3 rounded-card border bg-card p-4 text-sm">
            <div>
              <p className="font-semibold first-letter:uppercase">{formatLongDate(chosen.date)} às {chosen.time}</p>
              <p className="text-muted-foreground">{proName(chosen.professionalId)}</p>
            </div>
            <button type="button" className="text-sm font-medium text-primary underline-offset-4 hover:underline pointer-coarse:min-h-11" onClick={() => setChosen(null)}>Trocar</button>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bk-name">Nome completo</Label>
            <Input id="bk-name" autoComplete="name" className="h-11 text-base" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bk-phone">WhatsApp</Label>
            <Input id="bk-phone" inputMode="tel" autoComplete="tel" placeholder="(11) 98888-7777" className="h-11 text-base" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <p className="text-xs text-muted-foreground">Vamos mandar um código para confirmar.</p>
          </div>
          <Button
            className="h-11 w-full"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const r = await actions.startBooking({ slug: page.slug, unitId, professionalId: chosen.professionalId, procedureId: procedureId || null, startsAt: chosen.startsAt, name, phone });
                if (r.error || !r.requestId) {
                  setError(r.error ?? "Não foi possível continuar.");
                  if (r.error?.includes("ocupado")) setChosen(null);
                } else setRequest({ id: r.requestId, devCode: r.devCode });
              })
            }
          >
            {pending ? "Enviando..." : "Receber código"}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <Steps current={3} />
          <p className="text-sm">Digite o código de 6 números que enviamos para o seu WhatsApp.</p>
          {request.devCode ? (
            <p className="rounded-lg border border-dashed px-3 py-2 text-sm" role="note">Modo de teste (WhatsApp não configurado): o código é <strong className="tabular-nums">{request.devCode}</strong>.</p>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="bk-code">Código</Label>
            <Input id="bk-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className={cn("h-11 text-center text-lg tracking-[0.4em] tabular-nums")} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          </div>
          <Button
            className="h-11 w-full"
            disabled={pending || code.length !== 6}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const r = await actions.finishBooking({ slug: page.slug, requestId: request.id, code });
                if (r.error) {
                  setError(r.error);
                  if (r.error.includes("ocupado") || r.error.includes("Comece")) {
                    setRequest(null);
                    setChosen(null);
                  }
                } else setDone(r);
              })
            }
          >
            {pending ? "Confirmando..." : "Confirmar agendamento"}
          </Button>
        </div>
      )}
    </div>
  );
}
