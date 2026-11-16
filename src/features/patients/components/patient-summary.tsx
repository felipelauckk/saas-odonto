import { ShieldCheck, TriangleAlert } from "lucide-react";
import { cn } from "cn";

import { formatCurrency } from "@/lib/format";
import type { Optional } from "@/lib/optional";

import type { getPatientSummary } from "../queries";
import { lastVisitLabel, nextVisitLabel } from "../summary";

type Summary = Awaited<ReturnType<typeof getPatientSummary>>;
type Alert = { label: string | null; details: string | null };

function Fact({ label, children, muted = false }: { label: string; children: React.ReactNode; muted?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 border-t border-border-soft px-4 py-3.5 sm:px-5 lg:border-t-0 lg:border-l">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("text-[0.9375rem] font-semibold tabular-nums", muted && "font-medium text-muted-foreground")}>{children}</dd>
    </div>
  );
}

/**
 * Faixa sob o nome: alerta clínico sempre visível (vermelho) e os três fatos do
 * paciente. Se a leitura do resumo falhar, só os fatos dão lugar a um aviso.
 */
export function PatientSummary({ alerts, summary }: { alerts: Alert[]; summary: Optional<Summary> }) {
  const facts = summary.ok ? summary.value : null;
  const withBalance = Boolean(facts?.balance);

  return (
    <section
      aria-label="Resumo do paciente"
      className={cn(
        "grid overflow-hidden rounded-card border bg-card",
        withBalance ? "lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]" : "lg:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,1fr))]",
      )}
    >
      {alerts.length ? (
        <div role="note" aria-label="Alertas da anamnese" className="flex gap-3 bg-destructive-soft px-4 py-3.5 sm:px-5">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-destructive" strokeWidth={2} aria-hidden />
          <div className="min-w-0 space-y-0.5">
            <p className="text-[0.8125rem] font-bold text-destructive">Atenção na anamnese</p>
            <ul className="space-y-0.5 text-[0.8125rem] text-destructive">
              {alerts.map((a, i) => (
                <li key={i}>
                  {a.label}
                  {a.details ? <strong className="font-semibold"> — {a.details}</strong> : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-4 py-3.5 text-[0.8125rem] text-muted-foreground sm:px-5">
          <ShieldCheck className="size-5 shrink-0 text-success" strokeWidth={1.75} aria-hidden />
          Nenhum alerta na anamnese
        </div>
      )}

      {facts ? (
        <dl className={cn("grid grid-cols-2 lg:contents", withBalance ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
          <Fact label="Próxima consulta" muted={!facts.next}>
            {facts.next ? nextVisitLabel(facts.next.starts_at) : "Nenhuma marcada"}
          </Fact>
          {facts.balance ? (
            <Fact label="Em aberto" muted={facts.balance.openCents === 0}>
              {facts.balance.openCents === 0 ? (
                "Nada em aberto"
              ) : (
                <>
                  {formatCurrency(facts.balance.openCents)}
                  {facts.balance.overdueCents > 0 ? (
                    <span className="block text-xs font-semibold text-destructive">{formatCurrency(facts.balance.overdueCents)} vencido</span>
                  ) : null}
                </>
              )}
            </Fact>
          ) : null}
          <Fact label="Última visita" muted={!facts.last}>
            {facts.last ? lastVisitLabel(facts.last.starts_at, facts.last.type) : "Nenhuma ainda"}
          </Fact>
        </dl>
      ) : (
        <p
          role="alert"
          className="flex items-center border-t border-border-soft px-4 py-3.5 text-[0.8125rem] text-muted-foreground sm:px-5 lg:col-span-3 lg:border-t-0 lg:border-l"
        >
          Não foi possível carregar o resumo agora. Recarregue a página.
        </p>
      )}
    </section>
  );
}
