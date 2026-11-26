"use client";

import type { ReactNode } from "react";
import { cn } from "cn";

import { SegmentedControl } from "@/components/app/segmented-control";
import { DialogTitle } from "@/components/ui/dialog";

/** Peças comuns do diálogo da agenda (Consulta e Compromisso). */

export type EntryTab = "consulta" | "compromisso";

/** Cabeçalho: abas "Consulta | Compromisso" (só ao criar) e o título. */
export function EntryHeader({ tab, onTab, title }: { tab: EntryTab; onTab?: (tab: EntryTab) => void; title: string }) {
  return (
    <header className="space-y-3 border-b px-5 pt-5 pb-4 pr-12">
      {onTab ? (
        <SegmentedControl
          label="O que marcar"
          value={tab}
          onChange={onTab}
          options={[
            { value: "consulta", label: "Consulta" },
            { value: "compromisso", label: "Compromisso" },
          ]}
        />
      ) : null}
      <DialogTitle className="type-title">{title}</DialogTitle>
    </header>
  );
}

/** Rodapé fixo: resumo à esquerda, ações à direita. */
export function EntryFooter({ summary, children }: { summary: ReactNode; children: ReactNode }) {
  return (
    <footer className="flex flex-col gap-3 border-t bg-muted/40 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center">
      <p className="min-w-0 text-sm font-medium tabular-nums" aria-live="polite">
        {summary}
      </p>
      <div className="flex gap-2 sm:ml-auto">{children}</div>
    </footer>
  );
}

const weekdayShort = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "2-digit" });

/** "Qui, 26/11" */
export function shortDate(date: string) {
  const parts = weekdayShort.formatToParts(new Date(`${date}T00:00:00Z`));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const wd = get("weekday").replace(".", "");
  return `${wd.charAt(0).toUpperCase()}${wd.slice(1)}, ${get("day")}/${get("month")}`;
}

/** Escolha única em pílulas (radiogroup). */
export function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex h-9 items-center rounded-full border px-3.5 text-[0.8125rem] font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-50 pointer-coarse:h-11",
              on ? "border-foreground bg-foreground font-semibold text-background" : "border-input bg-card hover:bg-muted",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Section({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-4 border-t pt-5 first:border-t-0 first:pt-0", className)}>
      {title ? <h3 className="text-[0.8125rem] font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3> : null}
      {children}
    </section>
  );
}
