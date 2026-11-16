import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "cn";

type Props = {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  /** "highlight" usa o fundo petróleo profundo (faixa do painel, vaga na agenda). */
  variant?: "default" | "highlight";
  className?: string;
};

/** Sugestão da IA dentro do trabalho, nunca num chat solto. */
export function AiSuggestion({ title, children, action, variant = "default", className }: Props) {
  const dark = variant === "highlight";
  return (
    <section
      aria-label={title}
      className={cn(
        "flex flex-col gap-3 rounded-card p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5",
        dark ? "bg-brand-deep text-white" : "border border-border bg-card",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", dark ? "bg-white/10 text-brand-highlight" : "bg-accent text-primary")}
      >
        <Sparkles className="size-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-semibold", dark ? "text-white" : "text-foreground")}>{title}</p>
        <div className={cn("mt-0.5 text-sm", dark ? "text-white/80" : "text-muted-foreground")}>{children}</div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </section>
  );
}
