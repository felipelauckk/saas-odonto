"use client";

import { useEffect, useState, useTransition } from "react";
import { CalendarCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "cn";

import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addDays, formatLongDate } from "@/lib/timezone";

import type { BookingPage } from "../service";
import type { Slot } from "../slots";

type Actions = {
  getSlots: (input: { slug: string; unitId: string; professionalId: string | null; procedureId: string | null; from: string }) => Promise<Slot[] | null>;
  startBooking: (input: { slug: string; unitId: string; professionalId: string | null; procedureId: string | null; startsAt: string; name: string; phone: string }) => Promise<{ error?: string; requestId?: string; devCode?: string }>;
  finishBooking: (input: { slug: string; requestId: string; code: string }) => Promise<{ error?: string; when?: string; professionalName?: string; unitName?: string }>;
};

const select = "h-11 w-full rounded-lg border bg-background px-3 text-base";

export function BookingWizard({ page, today, actions }: { page: BookingPage; today: string; actions: Actions }) {
  const [unitId, setUnitId] = useState(page.units[0]?.id ?? "");
  const [procedureId, setProcedureId] = useState<string>(page.procedures[0]?.id ?? "");
  const [professionalId, setProfessionalId] = useState<string>("");
  const [from, setFrom] = useState(today);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [chosen, setChosen] = useState<Slot | null>(null);
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
      <div className="flex flex-col items-center gap-3 rounded-xl border p-8 text-center">
        <CalendarCheck className="size-10 text-primary" aria-hidden />
        <h2 className="text-lg font-semibold">Consulta marcada!</h2>
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

  return (
    <div className="space-y-6">
      {error ? <FormMessage state={{ status: "error", message: error }} /> : null}

      {!chosen ? (
        <>
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

          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" size="icon" aria-label="Semana anterior" disabled={from <= today} onClick={() => setFrom(from <= addDays(today, 7) ? today : addDays(from, -7))}>
              <ChevronLeft />
            </Button>
            <p className="text-sm font-medium">Horários a partir de {from.split("-").reverse().join("/")}</p>
            <Button variant="outline" size="icon" aria-label="Próxima semana" disabled={addDays(from, 7) > lastDay} onClick={() => setFrom(addDays(from, 7))}>
              <ChevronRight />
            </Button>
          </div>

          {slots === null ? (
            <p className="text-sm text-muted-foreground" role="status">Carregando horários...</p>
          ) : byDay.size ? (
            <div className="space-y-4">
              {[...byDay.entries()].map(([date, list]) => (
                <section key={date} aria-label={formatLongDate(date)} className="space-y-2">
                  <h3 className="text-sm font-medium first-letter:uppercase">{formatLongDate(date)}</h3>
                  <div className="flex flex-wrap gap-2">
                    {list.map((s) => (
                      <button key={`${s.startsAt}-${s.professionalId}`} type="button" onClick={() => setChosen(s)}
                        className="h-11 min-w-20 rounded-lg border px-3 text-sm font-medium tabular-nums hover:border-primary hover:bg-primary/10">
                        {s.time}
                        {professionalId ? "" : <span className="sr-only"> com {proName(s.professionalId)}</span>}
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed px-6 py-8 text-center text-sm text-muted-foreground">Nenhum horário livre nesta semana. Veja a próxima.</p>
          )}
        </>
      ) : !request ? (
        <div className="space-y-4">
          <div className="rounded-xl border p-4 text-sm">
            <p className="font-medium first-letter:uppercase">{formatLongDate(chosen.date)} às {chosen.time}</p>
            <p className="text-muted-foreground">{proName(chosen.professionalId)}</p>
            <button type="button" className="mt-1 text-sm underline underline-offset-4" onClick={() => setChosen(null)}>Trocar horário</button>
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
