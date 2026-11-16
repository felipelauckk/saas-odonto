import { biggestLoss, funnelRates, type FunnelStep } from "../logic";

import { BlockEmpty } from "./dashboard-card";

const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });

/** Do mais escuro (entrada) ao destaque (fechamento). */
const barClass = ["bg-brand-deep", "bg-primary-hover", "bg-primary", "bg-brand-highlight"];

/** Funil do primeiro contato ao tratamento fechado, com a frase da maior perda. */
export function FunnelBars({ steps }: { steps: FunnelStep[] }) {
  if (!steps[0]?.value) return <BlockEmpty>Nenhum contato novo neste mês ainda.</BlockEmpty>;

  const rows = funnelRates(steps);
  const loss = biggestLoss(steps);

  return (
    <>
      <ol className="flex flex-col gap-2.5">
        {rows.map((r, i) => (
          <li key={r.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 text-[0.8125rem] sm:grid-cols-[10rem_minmax(0,1fr)_4.5rem]">
            <span className="truncate">{r.label}</span>
            <span className="order-last col-span-2 h-6 overflow-hidden rounded-md bg-muted sm:order-none sm:col-span-1" aria-hidden>
              <span className={`block h-full rounded-md ${barClass[i] ?? "bg-primary"}`} style={{ width: `${Math.max(r.share * 100, r.value ? 2 : 0)}%` }} />
            </span>
            <span className="text-right tabular-nums">
              <strong className="font-semibold">{r.value}</strong>
              {r.rate !== null ? <span className="text-muted-foreground"> {pct.format(r.rate)}</span> : null}
            </span>
          </li>
        ))}
      </ol>
      {loss ? (
        <p className="border-t border-border-soft pt-3 text-[0.8125rem] text-muted-foreground">
          A maior perda está entre{" "}
          <strong className="font-semibold text-foreground">
            {loss.from.toLowerCase()} e {loss.to.toLowerCase()}
          </strong>
          : {loss.lost} {loss.lost === 1 ? "pessoa não avançou" : "pessoas não avançaram"}.
        </p>
      ) : null}
    </>
  );
}
