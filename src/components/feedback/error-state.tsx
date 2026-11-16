"use client";

import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

type ErrorStateProps = {
  title?: string;
  description?: string;
  onRetry?: () => void;
};

export function ErrorState({
  title = "Algo deu errado",
  description = "Não foi possível carregar esta página. Tente novamente.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-card border border-border bg-card px-6 py-14 text-center"
    >
      <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-destructive-soft text-destructive">
        <AlertCircle className="size-5" strokeWidth={1.75} aria-hidden />
      </div>
      <h2 className="type-section">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {onRetry ? (
        <Button variant="outline" className="mt-6" onClick={onRetry}>
          Tentar novamente
        </Button>
      ) : null}
    </div>
  );
}
