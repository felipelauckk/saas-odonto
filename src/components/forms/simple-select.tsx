"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Option = { value: string; label: string };

type SimpleSelectProps = {
  id: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  "aria-label"?: string;
  className?: string;
};

/** Seleção controlada (estado no componente pai), com rótulo opcional. */
export function SimpleSelect({ id, label, value, onChange, options, className, ...rest }: SimpleSelectProps) {
  return (
    <div className={label ? "space-y-1.5" : undefined}>
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <Select items={options} value={value} onValueChange={(v) => onChange(String(v))}>
        <SelectTrigger
          id={id}
          aria-label={rest["aria-label"]}
          className={className ?? "w-full data-[size=default]:h-9 pointer-coarse:data-[size=default]:h-11"}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className="pointer-coarse:min-h-11">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
