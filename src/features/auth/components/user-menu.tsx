"use client";

import { useTransition } from "react";
import { ChevronsUpDown, KeyRound, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { signOut } from "../actions";

type UserMenuProps = {
  name: string | null;
  email: string;
  /** Linha de apoio, ex.: "Gestor · CRO-RS 18.204". Sem ela, mostra o e-mail. */
  subtitle?: string;
};

function initials(name: string | null, email: string) {
  const source = name?.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? `${parts[0]![0]}${parts.at(-1)![0]}` : source.slice(0, 2);
  return letters.toUpperCase();
}

export function UserMenu({ name, email, subtitle }: UserMenuProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Menu do usuário"
        disabled={pending}
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring pointer-coarse:min-h-11"
      >
        <span
          className="flex size-8.5 shrink-0 items-center justify-center rounded-full bg-tint-peach text-xs font-bold text-tint-peach-foreground"
          aria-hidden
        >
          {initials(name, email)}
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate text-sm font-semibold">{name ?? email}</span>
          {subtitle || name ? (
            <span className="block truncate text-xs text-sidebar-foreground/70">{subtitle ?? email}</span>
          ) : null}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-sidebar-foreground/70" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="truncate">{email}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="pointer-coarse:min-h-11" onClick={() => router.push("/nova-senha")}>
          <KeyRound aria-hidden />
          Trocar senha
        </DropdownMenuItem>
        <DropdownMenuItem
          className="pointer-coarse:min-h-11"
          onClick={() => startTransition(() => signOut())}
        >
          <LogOut aria-hidden />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
