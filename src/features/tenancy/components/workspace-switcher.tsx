"use client";

import { useTransition } from "react";
import { ChevronsUpDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { switchClinic, switchUnit } from "../actions";
import { roleLabels, type MemberRole } from "../roles";

type WorkspaceSwitcherProps = {
  clinics: { id: string; name: string; role: MemberRole }[];
  currentClinicId: string;
  units: { id: string; name: string }[];
  activeUnitId: string | null;
};

/**
 * Clínica e unidade ativas no menu lateral. Vira seletor quando há mais de uma
 * clínica ou mais de uma unidade; com uma só de cada, é só a identificação.
 */
export function WorkspaceSwitcher({ clinics, currentClinicId, units, activeUnitId }: WorkspaceSwitcherProps) {
  const [pending, startTransition] = useTransition();
  const clinic = clinics.find((c) => c.id === currentClinicId);
  if (!clinic) return null;

  const multiClinic = clinics.length > 1;
  const multiUnit = units.length > 1;
  const activeUnit = units.find((u) => u.id === activeUnitId) ?? units[0];
  const subtitle = multiUnit && activeUnit ? activeUnit.name : roleLabels[clinic.role];

  const label = (
    <span className="min-w-0 flex-1 text-left">
      <span className="block truncate text-sm font-semibold">{clinic.name}</span>
      <span className="block truncate text-xs text-sidebar-foreground/70">{subtitle}</span>
    </span>
  );

  const boxClass =
    "flex min-h-13 w-full items-center gap-2 rounded-xl border border-sidebar-border bg-white/6 px-3 py-2 text-sidebar-foreground";

  if (!multiClinic && !multiUnit) return <div className={boxClass}>{label}</div>;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={multiClinic ? "Trocar de clínica" : "Trocar de unidade"}
        disabled={pending}
        className={`${boxClass} outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring disabled:opacity-60`}
      >
        {label}
        <ChevronsUpDown className="size-4 shrink-0 text-sidebar-foreground/70" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-60">
        {multiClinic ? (
          <DropdownMenuGroup>
            <DropdownMenuLabel>Clínicas</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={currentClinicId}
              onValueChange={(value: string) => {
                if (value !== currentClinicId) startTransition(() => void switchClinic(value));
              }}
            >
              {clinics.map((c) => (
                <DropdownMenuRadioItem key={c.id} value={c.id} className="pointer-coarse:min-h-11">
                  <span className="truncate">{c.name}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        ) : null}
        {multiClinic && multiUnit ? <DropdownMenuSeparator /> : null}
        {multiUnit ? (
          <DropdownMenuGroup>
            <DropdownMenuLabel>Unidades</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={activeUnit?.id}
              onValueChange={(value: string) => {
                if (value !== activeUnit?.id) startTransition(() => void switchUnit(value));
              }}
            >
              {units.map((unit) => (
                <DropdownMenuRadioItem key={unit.id} value={unit.id} className="pointer-coarse:min-h-11">
                  <span className="truncate">{unit.name}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
