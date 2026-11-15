import type { Metadata } from "next";
import { z } from "zod";

import { SubpageHeader } from "@/components/layout/subpage-header";
import { crcQueues, queueLabels } from "@/features/crc/labels";
import { getCrcStats } from "@/features/crc/queries";
import { PeriodFilter } from "@/features/payables/components/period-filter";
import { requireFrontDesk } from "@/features/tenancy/guards";
import { todayIso } from "@/lib/dates";
import { formatCurrency } from "@/lib/format";
import { addDays } from "@/lib/timezone";

export const metadata: Metadata = { title: "Indicadores da CRC" };

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });

export default async function Page({ searchParams }: PageProps<"/crc/indicadores">) {
  await requireFrontDesk();
  const params = await searchParams;
  const to = isoDate.catch(todayIso()).parse(params.ate);
  const from = isoDate.catch(addDays(to, -29)).parse(params.de);
  const { byQueue, perDay } = await getCrcStats(from, to);

  const totalContacts = [...perDay.values()].reduce((a, b) => a + b, 0);
  const days: string[] = [];
  for (let d = from; d <= to && days.length < 92; d = addDays(d, 1)) days.push(d);
  const max = Math.max(1, ...perDay.values());
  const recoveredCents = byQueue.reduce((a, q) => a + Number(q.recovered_cents), 0);
  const contacted = byQueue.reduce((a, q) => a + q.contacted, 0);
  const recovered = byQueue.reduce((a, q) => a + q.recovered, 0);

  return (
    <div className="space-y-6">
      <SubpageHeader title="Indicadores da CRC" description="Contatos feitos e quanto voltou." backHref="/crc" backLabel="CRC" />
      <PeriodFilter fields={[{ name: "de", label: "De", type: "date", value: from }, { name: "ate", label: "Até", type: "date", value: to }]} />

      <dl className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border p-4"><dt className="text-sm text-muted-foreground">Contatos</dt><dd className="text-2xl font-semibold tabular-nums">{totalContacts}</dd></div>
        <div className="rounded-xl border p-4"><dt className="text-sm text-muted-foreground">Média por dia</dt><dd className="text-2xl font-semibold tabular-nums">{(totalContacts / Math.max(1, days.length)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</dd></div>
        <div className="rounded-xl border p-4"><dt className="text-sm text-muted-foreground">Taxa de recuperação</dt><dd className="text-2xl font-semibold tabular-nums">{percent.format(contacted ? recovered / contacted : 0)}</dd></div>
        <div className="rounded-xl border p-4"><dt className="text-sm text-muted-foreground">Valor recuperado</dt><dd className="text-2xl font-semibold tabular-nums">{formatCurrency(recoveredCents)}</dd></div>
      </dl>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Fila</th>
              <th className="px-4 py-2 text-right font-medium">Pacientes contatados</th>
              <th className="px-4 py-2 text-right font-medium">Recuperados</th>
              <th className="px-4 py-2 text-right font-medium">Taxa</th>
              <th className="px-4 py-2 text-right font-medium">Valor recuperado</th>
            </tr>
          </thead>
          <tbody className="divide-y tabular-nums">
            {crcQueues.map((q) => {
              const row = byQueue.find((r) => r.queue === q);
              const isBirthday = q === "birthdays";
              return (
                <tr key={q}>
                  <td className="px-4 py-2">{queueLabels[q]}</td>
                  <td className="px-4 py-2 text-right">{row?.contacted ?? 0}</td>
                  <td className="px-4 py-2 text-right">{isBirthday ? "—" : (row?.recovered ?? 0)}</td>
                  <td className="px-4 py-2 text-right">{isBirthday || !row?.contacted ? "—" : percent.format(row.recovered / row.contacted)}</td>
                  <td className="px-4 py-2 text-right">{isBirthday ? "—" : formatCurrency(Number(row?.recovered_cents ?? 0))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <section className="space-y-2" aria-labelledby="por-dia">
        <h2 id="por-dia" className="text-sm font-medium text-muted-foreground">Contatos por dia</h2>
        <ul className="space-y-1">
          {days.map((d) => {
            const n = perDay.get(d) ?? 0;
            return (
              <li key={d} className="flex items-center gap-3 text-sm">
                <span className="w-12 shrink-0 tabular-nums text-muted-foreground">{d.slice(8, 10)}/{d.slice(5, 7)}</span>
                <span className="h-3 rounded-sm bg-primary/70" style={{ width: `${(n / max) * 70}%` }} aria-hidden />
                <span className="tabular-nums">{n}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
