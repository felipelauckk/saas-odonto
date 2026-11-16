import Link from "next/link";
import { Sparkles } from "lucide-react";
import { cn } from "cn";

import { joinPt, type DaySummary } from "../logic";

type Action = { href: string; label: string; primary?: boolean };

/** Faixa escura com o resumo do dia em uma frase e atalhos para agir. */
export function DaySummaryBanner({ summary, actions }: { summary: DaySummary; actions: Action[] }) {
  const { pace, todos } = summary;
  const empty = !pace && !todos.length;

  return (
    <section aria-label="Resumo do dia" className="flex flex-wrap items-center gap-4 rounded-card bg-brand-deep px-4 py-4 text-brand-deep-foreground sm:px-5">
      <span className="hidden size-9 shrink-0 items-center sm:flex justify-center rounded-lg bg-brand-highlight/20 text-brand-highlight" aria-hidden>
        <Sparkles className="size-4.5" strokeWidth={1.75} />
      </span>
      <p className="min-w-0 flex-[1_1_20rem] text-sm leading-relaxed text-brand-deep-foreground/90">
        {empty ? (
          "Tudo em dia: nenhuma pendência para hoje."
        ) : (
          <>
            {pace ? (
              <>
                {pace.before}
                <strong className="font-semibold text-brand-deep-foreground">{pace.strong}</strong>.{" "}
              </>
            ) : null}
            {todos.length ? `Para hoje: ${joinPt(todos)}.` : null}
          </>
        )}
      </p>
      {actions.length ? (
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className={cn(
                "inline-flex h-9 items-center rounded-lg px-3 text-[0.8125rem] font-semibold outline-none focus-visible:ring-3 focus-visible:ring-brand-highlight/60 pointer-coarse:h-11",
                a.primary ? "bg-brand-highlight text-brand-deep hover:bg-brand-highlight/90" : "bg-brand-deep-foreground/10 text-brand-deep-foreground hover:bg-brand-deep-foreground/15",
              )}
            >
              {a.label}
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}
