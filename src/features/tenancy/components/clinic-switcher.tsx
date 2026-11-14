"use client";

import { useTransition } from "react";
import { Building2, ChevronsUpDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { switchClinic } from "../actions";
import { roleLabels, type MemberRole } from "../roles";

type ClinicSwitcherProps = {
  clinics: { id: string; name: string; role: MemberRole }[];
  currentId: string;
};

/** Nome da clínica ativa; vira seletor quando o usuário tem mais de uma. */
export function ClinicSwitcher({ clinics, currentId }: ClinicSwitcherProps) {
  const [pending, startTransition] = useTransition();
  const current = clinics.find((c) => c.id === currentId);
  if (!current) return null;

  const label = (
    <>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background">
        <Building2 className="size-4 text-muted-foreground" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-medium">{current.name}</span>
        <span className="block truncate text-xs text-muted-foreground">{roleLabels[current.role]}</span>
      </span>
    </>
  );

  if (clinics.length < 2) {
    return <div className="flex items-center gap-2.5 px-2 py-1.5">{label}</div>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Trocar de clínica"
        disabled={pending}
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 outline-none hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-sidebar-ring/40 disabled:opacity-60 pointer-coarse:min-h-11"
      >
        {label}
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Clínicas</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={currentId}
            onValueChange={(value: string) => {
              if (value !== currentId) startTransition(() => void switchClinic(value));
            }}
          >
            {clinics.map((clinic) => (
              <DropdownMenuRadioItem key={clinic.id} value={clinic.id} className="pointer-coarse:min-h-11">
                <span className="truncate">{clinic.name}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
