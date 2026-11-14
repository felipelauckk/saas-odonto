"use client";

import { useTransition } from "react";
import { ChevronDown, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { switchUnit } from "../actions";

type UnitSwitcherProps = {
  units: { id: string; name: string }[];
  activeId: string | null;
};

/** Seletor de unidade. Só aparece quando há mais de uma unidade. */
export function UnitSwitcher({ units, activeId }: UnitSwitcherProps) {
  const [pending, startTransition] = useTransition();
  if (units.length < 2) return null;
  const active = units.find((u) => u.id === activeId) ?? units[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="sm" disabled={pending} aria-label="Trocar de unidade" />}
      >
        <MapPin aria-hidden />
        <span className="max-w-40 truncate">{active?.name}</span>
        <ChevronDown aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Unidades</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={active?.id}
            onValueChange={(value: string) => {
              if (value !== active?.id) startTransition(() => void switchUnit(value));
            }}
          >
            {units.map((unit) => (
              <DropdownMenuRadioItem key={unit.id} value={unit.id} className="pointer-coarse:min-h-11">
                {unit.name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
