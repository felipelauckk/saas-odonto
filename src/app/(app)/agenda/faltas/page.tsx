import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { z } from "zod";

import { EmptyState } from "@/components/feedback/empty-state";
import { SubpageHeader } from "@/components/layout/subpage-header";
import { Badge } from "@/components/ui/badge";
import { cancelReasonLabels, type CancelReason } from "@/features/agenda/advanced";
import { getAttendanceReport } from "@/features/agenda/queries";
import { PeriodFilter } from "@/features/payables/components/period-filter";
import { requireClinic } from "@/features/tenancy/guards";
import { todayIso } from "@/lib/dates";
import { formatPhone } from "@/lib/documents";
import { createClient } from "@/lib/supabase/server";
import { addDays, formatLongDate, utcToZoned } from "@/lib/timezone";

export const metadata: Metadata = { title: "Faltas e desmarcações" };

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });

export default async function Page({ searchParams }: PageProps<"/agenda/faltas">) {
  await requireClinic();
  const params = await searchParams;
  const today = todayIso();
  const to = isoDate.catch(today).parse(params.ate);
  const from = isoDate.catch(addDays(to, -29)).parse(params.de);
  const supabase = await createClient();
  const { data: pros } = await supabase.from("professionals").select("id, name").eq("active", true).order("name");
  const professionalId = z.uuid().safeParse(params.profissional).success ? (params.profissional as string) : null;
  const report = await getAttendanceReport({ from, to, professionalId });
  const noShows = report.events.filter((e) => e.status === "no_show").length;
  const canceled = report.events.filter((e) => e.status === "canceled");
  const reasonCount = (r: CancelReason) => canceled.filter((c) => c.cancel_reason === r).length;

  return (
    <div className="space-y-6">
      <SubpageHeader title="Faltas e desmarcações" description="Por período, profissional e motivo." backHref="/agenda" backLabel="Agenda" />
      <PeriodFilter
        fields={[{ name: "de", label: "De", type: "date", value: from }, { name: "ate", label: "Até", type: "date", value: to }]}
        selects={[{ name: "profissional", label: "Profissional", value: professionalId ?? "", options: [{ value: "", label: "Todos" }, ...(pros ?? []).map((p) => ({ value: p.id, label: p.name }))] }]}
      />
      <dl className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border p-4"><dt className="text-sm text-muted-foreground">Faltas</dt><dd className="text-2xl font-semibold tabular-nums">{noShows}</dd></div>
        <div className="rounded-xl border p-4"><dt className="text-sm text-muted-foreground">Taxa de faltas</dt><dd className="text-2xl font-semibold tabular-nums">{percent.format(report.pastNotCanceled ? noShows / report.pastNotCanceled : 0)}</dd></div>
        <div className="rounded-xl border p-4"><dt className="text-sm text-muted-foreground">Desmarcações</dt><dd className="text-2xl font-semibold tabular-nums">{canceled.length}</dd></div>
        <div className="rounded-xl border p-4 text-sm">
          <dt className="text-muted-foreground">Por motivo</dt>
          {(Object.keys(cancelReasonLabels) as CancelReason[]).map((r) => (
            <dd key={r} className="flex justify-between"><span>{cancelReasonLabels[r]}</span><span className="tabular-nums">{reasonCount(r)}</span></dd>
          ))}
        </div>
      </dl>

      {report.byProfessional.length ? (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-muted-foreground">
              <tr><th className="px-4 py-2 font-medium">Profissional</th><th className="px-4 py-2 text-right font-medium">Consultas</th><th className="px-4 py-2 text-right font-medium">Faltas</th><th className="px-4 py-2 text-right font-medium">Desmarcações</th></tr>
            </thead>
            <tbody className="divide-y tabular-nums">
              {report.byProfessional.map((p) => (
                <tr key={p.name}><td className="px-4 py-2">{p.name}</td><td className="px-4 py-2 text-right">{p.total}</td><td className="px-4 py-2 text-right">{p.noShow}</td><td className="px-4 py-2 text-right">{p.canceled}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {report.byTag.length ? (
        <section className="space-y-2" aria-labelledby="por-marcador">
          <h2 id="por-marcador" className="text-sm font-medium text-muted-foreground">Consultas por marcador</h2>
          <ul className="flex flex-wrap gap-2">
            {report.byTag.map((t) => (
              <li key={t.name} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: t.color }} aria-hidden />
                {t.name}: <span className="tabular-nums">{t.total}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {report.events.length ? (
        <ul className="divide-y rounded-xl border">
          {report.events.map((r) => {
            const when = utcToZoned(r.starts_at);
            const phone = r.patients?.whatsapp ?? r.patients?.phone;
            return (
              <li key={r.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
                <div className="min-w-0 flex-1">
                  <Link href={`/pacientes/${r.patient_id}`} className="font-medium hover:underline">{r.patients?.full_name ?? "Paciente"}</Link>
                  <p className="text-sm text-muted-foreground first-letter:uppercase">
                    {formatLongDate(when.date)} às {when.time} · {r.professionals?.name}
                    {r.cancel_note ? ` · ${r.cancel_note}` : ""}
                  </p>
                </div>
                <Badge variant={r.status === "no_show" ? "destructive" : "secondary"}>
                  {r.status === "no_show" ? "Faltou" : r.cancel_reason ? cancelReasonLabels[r.cancel_reason as CancelReason] : "Desmarcada"}
                </Badge>
                {phone ? <a href={`https://wa.me/55${phone}`} target="_blank" rel="noreferrer" className="text-sm text-muted-foreground hover:text-foreground">{formatPhone(phone)}</a> : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={CalendarCheck} title="Nenhuma falta ou desmarcação no período" />
      )}
    </div>
  );
}
