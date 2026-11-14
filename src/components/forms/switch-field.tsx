"use client";

import { useId } from "react";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type SwitchFieldProps = {
  name: string;
  label: string;
  description?: string;
  defaultChecked?: boolean;
};

/** Liga/desliga dentro de um formulário. Envia "on" quando ligado. */
export function SwitchField({ name, label, description, defaultChecked }: SwitchFieldProps) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border px-3 py-2.5 pointer-coarse:min-h-11">
      <div className="space-y-0.5">
        <Label htmlFor={id}>{label}</Label>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <Switch id={id} name={name} defaultChecked={defaultChecked} className="mt-0.5" />
    </div>
  );
}
