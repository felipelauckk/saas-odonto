"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Option = { value: string; label: string };

type SelectFieldProps = {
  name: string;
  label: string;
  options: Option[];
  defaultValue?: string;
  placeholder?: string;
  errors?: string[];
};

/** Lista de opções dentro de um formulário (envia o valor escolhido). */
export function SelectField({ name, label, options, defaultValue, placeholder, errors }: SelectFieldProps) {
  const error = errors?.[0];
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Select name={name} items={options} defaultValue={defaultValue ?? null}>
        <SelectTrigger
          id={name}
          aria-invalid={error ? true : undefined}
          className="w-full data-[size=default]:h-9 pointer-coarse:data-[size=default]:h-11"
        >
          <SelectValue placeholder={placeholder ?? "Selecione"} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} className="pointer-coarse:min-h-11">
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
