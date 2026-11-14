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

type UserMenuProps = { name: string | null; email: string };

function initials(name: string | null, email: string) {
  const source = name?.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? `${parts[0]![0]}${parts.at(-1)![0]}` : source.slice(0, 2);
  return letters.toUpperCase();
}

export function UserMenu({ name, email }: UserMenuProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Menu do usuário"
        disabled={pending}
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 outline-none hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-sidebar-ring/40 pointer-coarse:min-h-11"
      >
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-foreground"
          aria-hidden
        >
          {initials(name, email)}
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate text-sm font-medium">{name ?? email}</span>
          {name ? <span className="block truncate text-xs text-muted-foreground">{email}</span> : null}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
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
