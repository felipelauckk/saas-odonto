import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { z } from "zod";

import { EmptyState } from "@/components/feedback/empty-state";
import { SubpageHeader } from "@/components/layout/subpage-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listNoShows } from "@/features/agenda/queries";
import { requireClinic } from "@/features/tenancy/guards";
import { todayIso } from "@/lib/dates";
import { formatPhone } from "@/lib/documents";
import { addDays, formatLongDate, utcToZoned } from "@/lib/timezone";

export const metadata: Metadata = { title: "Faltas" };

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });

export default async function Page({ searchParams }: PageProps<"/agenda/faltas">) {
  await requireClinic();
  const params = await searchParams;
  const today = todayIso();
  const to = isoDate.catch(today).parse(params.ate);
  const from = isoDate.catch(addDays(to, -29)).parse(params.de);
  const { rows, base } = await listNoShows({ from, to });
  const rate = base ? rows.length / base : 0;

  return (
    <div className="space-y-6">
      <SubpageHeader title="Faltas" description="Consultas marcadas como “Faltou” no período." backHref="/agenda" backLabel="Agenda" />

      <form className="flex flex-wrap items-end gap-3" method="get">
        <div className="space-y-1.5">
          <Label htmlFor="de">De</Label>
          <Input id="de" name="de" type="date" defaultValue={from} className="w-auto" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ate">Até</Label>
          <Input id="ate" name="ate" type="date" defaultValue={to} className="w-auto" />
        </div>
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
      </form>

      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border p-4">
          <dt className="text-sm text-muted-foreground">Faltas</dt>
          <dd className="text-2xl font-semibold tabular-nums">{rows.length}</dd>
        </div>
        <div className="rounded-xl border p-4">
          <dt className="text-sm text-muted-foreground">Consultas no período</dt>
          <dd className="text-2xl font-semibold tabular-nums">{base}</dd>
        </div>
        <div className="rounded-xl border p-4">
          <dt className="text-sm text-muted-foreground">Taxa de faltas</dt>
          <dd className="text-2xl font-semibold tabular-nums">{percent.format(rate)}</dd>
        </div>
      </dl>
      <p className="text-xs text-muted-foreground">A taxa considera as consultas já passadas no período, sem as canceladas.</p>

      {rows.length ? (
        <ul className="divide-y rounded-xl border">
          {rows.map((r) => {
            const when = utcToZoned(r.starts_at);
            const phone = r.patients?.whatsapp ?? r.patients?.phone;
            return (
              <li key={r.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
                <div className="min-w-0 flex-1">
                  <Link href={`/pacientes/${r.patient_id}`} className="font-medium hover:underline">
                    {r.patients?.full_name ?? "Paciente"}
                  </Link>
                  <p className="text-sm text-muted-foreground first-letter:uppercase">
                    {formatLongDate(when.date)} às {when.time} · {r.professionals?.name}
                    {r.units?.name ? ` · ${r.units.name}` : ""}
                  </p>
                </div>
                {phone ? (
                  <a href={`https://wa.me/55${phone}`} target="_blank" rel="noreferrer" className="text-sm text-muted-foreground hover:text-foreground">
                    {formatPhone(phone)}
                  </a>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={CalendarCheck} title="Nenhuma falta no período" />
      )}
    </div>
  );
}
