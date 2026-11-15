import type { Metadata } from "next";
import { FileDown } from "lucide-react";
import { z } from "zod";

import { buttonVariants } from "@/components/ui/button";
import { getClinicalAccess } from "@/features/clinical/queries";
import { CloseMonthButton } from "@/features/commissions/components/close-month-button";
import { getStatement, listClosings } from "@/features/commissions/queries";
import type { Line } from "@/features/commissions/calc";
import { PeriodFilter } from "@/features/payables/components/period-filter";
import { requireClinic } from "@/features/tenancy/guards";
import { canManageClinic } from "@/features/tenancy/roles";
import { formatIsoDate, todayIso } from "@/lib/dates";
import { formatCurrency, formatDate } from "@/lib/format";
import { addMonths } from "@/lib/installments";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Comissões" };

export default async function Page({ searchParams }: PageProps<"/financeiro/comissoes">) {
  const session = await requireClinic();
  const manager = canManageClinic(session.clinic.role);
  const raw = await searchParams;
  const lastMonth = addMonths(`${todayIso().slice(0, 7)}-01`, -1).slice(0, 7);
  const month = z.string().regex(/^\d{4}-\d{2}$/).catch(lastMonth).parse(raw.mes);

  // Gestão escolhe o profissional; dentista vê só o próprio.
  const supabase = await createClient();
  const access = await getClinicalAccess();
  const { data: allPros } = manager ? await supabase.from("professionals").select("id, name").eq("active", true).order("name") : { data: null };
  const options = manager ? (allPros ?? []) : access.professionals;
  const professionalId = z.uuid().safeParse(raw.profissional).success && options.some((o) => o.id === raw.profissional) ? (raw.profissional as string) : options[0]?.id;

  if (!professionalId) {
    return <p className="text-sm text-muted-foreground">{manager ? "Cadastre profissionais para calcular comissões." : "Seu usuário não está ligado a um profissional."}</p>;
  }
  const [data, closings] = await Promise.all([getStatement(professionalId, month), listClosings(professionalId)]);
  if (!data) return null;
  const lines: Line[] = data.closing ? (data.closing.lines as Line[]) : data.statement.lines;
  const total = data.closing ? data.closing.total_commission_cents : data.statement.commissionCents;
  const monthLabel = new Date(`${month}-15T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <PeriodFilter
        fields={[{ name: "mes", label: "Mês", type: "month", value: month }]}
        selects={options.length > 1 ? [{ name: "profissional", label: "Profissional", value: professionalId, options: options.map((o) => ({ value: o.id, label: o.name })) }] : []}
      />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground first-letter:uppercase">
            {monthLabel} · {data.professional.name} · base {data.settings.base === "received" ? "recebido" : "executado"}
            {data.closing ? ` · fechado em ${formatDate(data.closing.closed_at)}` : " · em aberto (prévia)"}
          </p>
          <p className="text-2xl font-semibold tabular-nums">{formatCurrency(total)}</p>
        </div>
        {manager && !data.closing && month < todayIso().slice(0, 7) ? <CloseMonthButton professionalId={professionalId} month={month} label={`${monthLabel} de ${data.professional.name}`} /> : null}
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Data</th>
              <th className="px-3 py-2 font-medium">Paciente</th>
              <th className="px-3 py-2 font-medium">Descrição</th>
              <th className="px-3 py-2 text-right font-medium">Valor</th>
              <th className="px-3 py-2 text-right font-medium">Taxa</th>
              <th className="px-3 py-2 text-right font-medium">Laboratório</th>
              <th className="px-3 py-2 text-right font-medium">Base</th>
              <th className="px-3 py-2 text-right font-medium">Regra</th>
              <th className="px-3 py-2 text-right font-medium">Comissão</th>
            </tr>
          </thead>
          <tbody className="divide-y tabular-nums">
            {lines.length ? (
              lines.map((l, i) => (
                <tr key={i}>
                  <td className="px-3 py-2">{formatIsoDate(l.date)}</td>
                  <td className="px-3 py-2">{l.patientName}</td>
                  <td className="px-3 py-2">{l.description}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(l.grossCents)}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{l.feeCents ? formatCurrency(l.feeCents) : "—"}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{l.labCents ? formatCurrency(l.labCents) : "—"}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(l.baseCents)}</td>
                  <td className="px-3 py-2 text-right">{l.rule}</td>
                  <td className="px-3 py-2 text-right font-medium">{formatCurrency(l.commissionCents)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">Nada a comissionar neste mês.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {closings.length ? (
        <section className="space-y-2" aria-labelledby="fechamentos">
          <h2 id="fechamentos" className="text-sm font-medium text-muted-foreground">Meses fechados</h2>
          <ul className="divide-y rounded-xl border text-sm">
            {closings.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="first-letter:uppercase">{new Date(`${c.period_month}T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</span>
                <span className="flex items-center gap-3">
                  <span className="tabular-nums">{formatCurrency(c.total_commission_cents)}</span>
                  {c.pdf_path ? (
                    <a href={`/financeiro/comissoes/${c.id}/pdf`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
                      <FileDown aria-hidden />
                      Demonstrativo
                    </a>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
