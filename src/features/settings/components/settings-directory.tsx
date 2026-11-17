"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";

import { SETTINGS_GROUPS } from "../sections";

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** Todas as seções de Configurações em cartões por assunto, com busca. */
export function SettingsDirectory({ aiEnabled }: { aiEnabled: boolean }) {
  const [query, setQuery] = useState("");
  const q = fold(query.trim());
  const groups = SETTINGS_GROUPS.map((g) => ({
    ...g,
    sections: g.sections.filter((s) => (aiEnabled || !s.ai) && (!q || fold(`${s.title} ${s.description} ${g.title}`).includes(q))),
  })).filter((g) => g.sections.length > 0);

  return (
    <div className="space-y-6">
      <label className="relative block max-w-md">
        <span className="sr-only">Buscar configuração</span>
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar configuração (ex.: preços, horários)"
          className="h-11 pl-10"
        />
      </label>

      {groups.length === 0 ? (
        <p className="rounded-card border border-dashed px-6 py-8 text-center text-sm text-muted-foreground">
          Nenhuma configuração encontrada para “{query.trim()}”.
        </p>
      ) : (
        <nav aria-label="Seções das configurações" className="space-y-7">
          {groups.map((g) => (
            <section key={g.title} aria-labelledby={`grupo-${g.title}`} className="space-y-2.5">
              <h2 id={`grupo-${g.title}`} className="type-label text-muted-foreground">
                {g.title}
              </h2>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {g.sections.map(({ href, title, description, icon: Icon }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="flex h-full items-center gap-3.5 rounded-card border bg-card p-4 outline-none transition-colors hover:border-primary/40 hover:bg-accent/30 focus-visible:ring-3 focus-visible:ring-ring/40"
                    >
                      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                        <Icon className="size-[1.125rem]" />
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="text-sm font-semibold">{title}</span>
                        <span className="text-[0.8125rem] text-muted-foreground">{description}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
      )}
    </div>
  );
}
