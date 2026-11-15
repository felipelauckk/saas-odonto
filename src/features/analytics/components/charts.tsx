import { cn } from "cn";

/**
 * Gráficos simples em HTML/CSS (sem biblioteca): uma série por gráfico, na cor
 * de destaque; cada barra tem rótulo acessível e dica ao passar o mouse.
 */

export function MonthBars({ title, data, format }: { title: string; data: { label: string; value: number; highlight?: boolean }[]; format: (v: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <figure className="space-y-3 rounded-xl border p-4">
      <figcaption className="text-sm font-medium">{title}</figcaption>
      <ol className="flex h-40 items-end gap-1" aria-label={title}>
        {data.map((d) => (
          <li key={d.label} className="group relative flex h-full flex-1 flex-col justify-end" title={`${d.label}: ${format(d.value)}`}>
            <span className="sr-only">{`${d.label}: ${format(d.value)}`}</span>
            <span
              aria-hidden
              className={cn("block w-full rounded-t-[4px] transition-opacity group-hover:opacity-80", d.highlight ? "bg-primary" : "bg-primary/45")}
              style={{ height: `${Math.max(d.value > 0 ? 2 : 0, (d.value / max) * 100)}%` }}
            />
          </li>
        ))}
      </ol>
      <div className="flex gap-1 text-[11px] text-muted-foreground" aria-hidden>
        {data.map((d, i) => (
          <span key={d.label} className="flex-1 text-center">{i % 2 === data.length % 2 ? d.label : ""}</span>
        ))}
      </div>
    </figure>
  );
}

export function HorizontalBars({ title, data, format, max: fixedMax }: { title: string; data: { label: string; value: number | null }[]; format: (v: number) => string; max?: number }) {
  const max = fixedMax ?? Math.max(1, ...data.map((d) => d.value ?? 0));
  return (
    <figure className="space-y-3 rounded-xl border p-4">
      <figcaption className="text-sm font-medium">{title}</figcaption>
      {data.length ? (
        <ul className="space-y-2">
          {data.map((d) => (
            <li key={d.label} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm" title={`${d.label}: ${d.value === null ? "—" : format(d.value)}`}>
              <span className="truncate text-muted-foreground">{d.label}</span>
              <span className="h-3 rounded-full bg-muted" aria-hidden>
                <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, ((d.value ?? 0) / max) * 100)}%` }} />
              </span>
              <span className="tabular-nums">{d.value === null ? "—" : format(d.value)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Sem dados no período.</p>
      )}
    </figure>
  );
}

/** Meta × realizado: barra de progresso com texto (cor nunca é o único sinal). */
export function GoalTile({ label, actual, target, format }: { label: string; actual: number | null; target: number | undefined; format: (v: number) => string }) {
  const ratio = target && target > 0 && actual !== null ? actual / target : null;
  return (
    <div className="space-y-2 rounded-xl border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{actual === null ? "—" : format(actual)}</p>
      {ratio !== null ? (
        <>
          <div className="h-2 rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)} aria-label={`${label}: ${Math.round(ratio * 100)}% da meta`}>
            <div className={cn("h-full rounded-full", ratio >= 1 ? "bg-emerald-600" : "bg-primary")} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            {Math.round(ratio * 100)}% da meta de {format(target!)}
            {ratio >= 1 ? " · meta batida" : ""}
          </p>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">Sem meta definida</p>
      )}
    </div>
  );
}
