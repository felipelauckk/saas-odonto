import type { ComponentProps } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormFieldProps = ComponentProps<typeof Input> & {
  label: string;
  name: string;
  errors?: string[];
  hint?: string;
  /** Classes do contêiner (ex.: ocupar duas colunas na grade). */
  containerClassName?: string;
};

/** Rótulo + campo + mensagem de erro, com ligação de acessibilidade. */
export function FormField({ label, name, errors, hint, id, containerClassName, ...inputProps }: FormFieldProps) {
  const inputId = id ?? name;
  const error = errors?.[0];
  const describedBy = error ? `${inputId}-erro` : hint ? `${inputId}-dica` : undefined;

  return (
    <div className={containerClassName ? `space-y-1.5 ${containerClassName}` : "space-y-1.5"}>
      <Label htmlFor={inputId}>{label}</Label>
      <Input
        id={inputId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...inputProps}
      />
      {error ? (
        <p id={`${inputId}-erro`} className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-dica`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
