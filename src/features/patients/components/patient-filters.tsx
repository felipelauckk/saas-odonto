"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { cn } from "cn";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { sourceOptions, type PatientSourceOption } from "../sources";
import { SEGMENTS } from "../situation";

export type SegmentCounts = {
  active: number;
  in_treatment: number;
  open_quote: number;
  return_overdue: number;
  birthday: number;
  archived: number;
};

const count = new Intl.NumberFormat("pt-BR");

/** Busca, filtros rápidos com contagem e origem. Tudo fica na URL (dá para compartilhar e voltar). */
export function PatientFilters({ counts, sources }: { counts: SegmentCounts | null; sources: PatientSourceOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const archived = params.get("status") === "archived";
  const segment = archived ? null : (params.get("situacao") ?? null);
  const source = params.get("source") ?? "all";

  function navigate(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    next.delete("page");
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname));
  }

  // Busca enquanto digita, com uma pequena espera. Também roda quando a URL
  // muda: se uma navegação antiga terminar depois, a busca atual é refeita.
  const urlQuery = params.get("q") ?? "";
  useEffect(() => {
    if (query.trim() === urlQuery) return;
    const timer = setTimeout(() => navigate({ q: query.trim() || null }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, urlQuery]);

  const chips = [
    { key: "all", label: "Todos", n: counts?.active, pressed: !archived && !segment, go: { situacao: null, status: null } },
    ...SEGMENTS.map((s) => ({ key: s.slug, label: s.label, n: counts?.[s.value], pressed: segment === s.slug, go: { situacao: s.slug, status: null } })),
    { key: "archived", label: "Arquivados", n: counts?.archived, pressed: archived, go: { situacao: null, status: "archived" } },
  ];

  const sourceItems = [{ value: "all", label: "Todas as origens" }, ...sourceOptions(sources, source).map((s) => ({ value: s.id, label: s.name }))];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Buscar paciente</span>
          {pending ? (
            <Loader2 className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />
          ) : (
            <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          )}
          <input
            type="search"
            placeholder="Nome, CPF ou telefone"
            aria-label="Buscar paciente"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-12 w-full rounded-xl border bg-card pr-4 pl-12 text-[0.9375rem] shadow-card outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          />
        </label>
        <Select items={sourceItems} value={source} onValueChange={(value) => navigate({ source: value === "all" ? null : String(value) })}>
          <SelectTrigger aria-label="Origem" className="w-full md:w-48 data-[size=default]:h-12">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sourceItems.map((item) => (
              <SelectItem key={item.value} value={item.value} className="pointer-coarse:min-h-11">
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div role="group" aria-label="Filtros rápidos" className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:overflow-visible sm:px-0">
        <div className="flex w-max gap-1 rounded-xl border bg-card p-1 shadow-card sm:w-auto sm:flex-wrap">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-pressed={c.pressed}
            onClick={() => navigate(c.go)}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3.5 text-[0.8125rem] whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40 pointer-coarse:h-11",
              c.pressed ? "bg-foreground font-semibold text-background" : "font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {c.label}
            {c.n !== undefined ? (
              <span className={cn("text-xs font-semibold tabular-nums", c.pressed ? "text-background/75" : "text-muted-foreground/80")}>{count.format(c.n)}</span>
            ) : null}
          </button>
        ))}
        </div>
      </div>
    </div>
  );
}
