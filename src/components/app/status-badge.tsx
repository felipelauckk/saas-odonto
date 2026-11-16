import type { ReactNode } from "react";
import { cn } from "cn";

import type { StatusTone } from "@/lib/status-tones";

const TONES: Record<StatusTone, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-destructive-soft text-destructive",
  info: "bg-accent text-accent-foreground",
  neutral: "bg-border-soft text-muted-foreground",
};

/** Pílula com ponto e texto. A cor nunca é o único sinal: o texto diz o status. */
export function StatusBadge({ tone, children, className }: { tone: StatusTone; children: ReactNode; className?: string }) {
  return (
    <span
      data-slot="status-badge"
      data-tone={tone}
      className={cn("inline-flex h-6 w-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap", TONES[tone], className)}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
