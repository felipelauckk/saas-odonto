import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "cn";

import type { ActionState } from "@/lib/action-state";

/** Mensagem geral de um formulário (erro ou sucesso). */
export function FormMessage({ state, className }: { state: ActionState; className?: string }) {
  if (state.status === "idle" || !state.message) return null;
  const isError = state.status === "error";
  const Icon = isError ? AlertCircle : CheckCircle2;

  return (
    <div
      role={isError ? "alert" : "status"}
      className={cn(
        "flex gap-2.5 rounded-lg border px-3 py-2.5 text-sm",
        isError
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "border-primary/30 bg-primary/5 text-foreground",
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>{state.message}</p>
    </div>
  );
}
