"use client";

import { Fragment } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { REPORT_GROUPS, reportBySlug } from "../catalog";

/** Troca de relatório sem voltar à lista: um botão no lugar de um menu lateral fixo. */
export function ReportSwitcher({ current }: { current: string }) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={buttonVariants({ variant: "outline" })}>
        Trocar relatório
        <ChevronDown aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 max-w-[calc(100vw-2rem)] p-1.5">
        {REPORT_GROUPS.map((g, i) => (
          <Fragment key={g.title}>
            {i > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="type-label">{g.title}</DropdownMenuLabel>
              {g.slugs.map((slug) => {
                const def = reportBySlug.get(slug);
                if (!def) return null;
                const on = slug === current;
                return (
                  <DropdownMenuItem key={slug} className="min-h-9 pointer-coarse:min-h-11" onClick={() => router.push(`/relatorios/${slug}`)}>
                    <span className={on ? "flex-1 font-semibold" : "flex-1"}>{def.title}</span>
                    {on ? <Check className="text-primary" aria-label="Aberto" /> : null}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
