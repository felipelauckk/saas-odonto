"use client";

import { useEffect, useState } from "react";
import { cn } from "cn";

import { loadFreeSlots, type SlotsResult } from "../actions";

type Props = {
  professionalId: string;
  professionalName: string;
  date: string;
  durationMin: number;
  /** Consulta sendo editada (o horário dela conta como livre). */
  excludeId: string | null;
  value: string | null;
  onChange: (time: string) => void;
  error?: string;
};

/** Grade de horários livres do profissional no dia, em botões de 15 em 15 min. */
export function SlotPicker({ professionalId, professionalName, date, durationMin, excludeId, value, onChange, error }: Props) {
  const [outside, setOutside] = useState(false);
  const queryKey = `${professionalId}|${date}|${durationMin}|${excludeId}|${outside}`;
  const [loaded, setLoaded] = useState<{ key: string; result: SlotsResult } | null>(null);

  useEffect(() => {
    if (!professionalId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    let alive = true;
    loadFreeSlots({ professionalId, date, durationMin, excludeId, outsideHours: outside }).then((result) => {
      if (alive) setLoaded({ key: queryKey, result });
    });
    return () => {
      alive = false;
    };
  }, [professionalId, date, durationMin, excludeId, outside, queryKey]);

  const result = loaded?.key === queryKey ? loaded.result : null;
  const offered = new Set(result?.groups.flatMap((g) => g.times) ?? []);
  const toggle = (
    <button type="button" onClick={() => setOutside((v) => !v)} className="text-sm font-medium text-primary underline-offset-4 hover:underline pointer-coarse:min-h-11">
      {outside ? "Mostrar só o expediente" : "Mostrar fora do expediente"}
    </button>
  );

  return (
    <div className="space-y-3" aria-busy={!result}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-sm font-medium" id="slots-label">
          Horário
        </span>
        {toggle}
      </div>

      {outside ? (
        <p role="status" className="rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-[0.8125rem] text-warning">
          Mostrando todos os horários livres das 6h às 22h, inclusive fora do expediente de {professionalName}.
        </p>
      ) : null}

      {!result ? (
        <p className="text-sm text-muted-foreground">Carregando horários livres…</p>
      ) : result.error ? (
        <p className="text-sm text-destructive">{result.error}</p>
      ) : !result.groups.length ? (
        <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
          {!outside && !result.hasSchedule ? `${professionalName} não atende neste dia.` : "Nenhum horário livre neste dia com essa duração."}
        </p>
      ) : (
        <div role="radiogroup" aria-labelledby="slots-label" className="space-y-3">
          {result.groups.map((g) => (
            <div key={g.period} className="space-y-1.5">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{g.label}</p>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {g.times.map((t) => {
                  const on = t === value;
                  return (
                    <button
                      key={t}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => onChange(t)}
                      className={cn(
                        "h-10 rounded-lg border text-sm font-medium tabular-nums transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40 pointer-coarse:h-11",
                        on ? "border-primary bg-primary text-primary-foreground shadow-primary" : "border-input bg-card hover:bg-muted",
                      )}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {result && value && !offered.has(value) ? (
        <p role="status" className="text-[0.8125rem] text-warning">
          {value} não aparece entre os horários livres (ocupado, já passou ou fora do expediente). Escolha outro horário.
        </p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
