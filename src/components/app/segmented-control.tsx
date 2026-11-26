"use client";

import { cn } from "cn";

type Option<T extends string> = { value: T; label: string; disabled?: boolean; hint?: string };

type Props<T extends string> = {
  label: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

/** Escolha entre poucas opções lado a lado (ex.: Dia / Semana). */
export function SegmentedControl<T extends string>({ label, options, value, onChange, className }: Props<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-lg bg-track p-0.5", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={o.disabled}
            title={o.hint}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-9 rounded-md px-3.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:h-11",
              active ? "bg-card text-foreground shadow-segment" : "text-muted-foreground hover:text-foreground disabled:text-muted-foreground/60 disabled:hover:text-muted-foreground/60",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
