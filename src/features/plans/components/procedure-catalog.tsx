"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Plus, Search } from "lucide-react";
import { cn } from "cn";

export type CatalogProcedure = { id: string; name: string; applies_to_tooth: boolean; category: string | null };

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

const chip = (on: boolean) =>
  cn(
    "inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-[0.8125rem] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40 pointer-coarse:h-11",
    on ? "border-foreground bg-foreground font-semibold text-background" : "border-input bg-card hover:bg-muted",
  );

type Props<P extends CatalogProcedure> = {
  procedures: P[];
  onPick: (procedure: P) => void;
  /** Texto à direita de cada linha (preço no orçamento, duração na consulta). */
  meta: (procedure: P) => ReactNode;
  /** Rótulo do botão para leitor de tela. */
  actionLabel?: (procedure: P) => string;
  autoFocus?: boolean;
  listClassName?: string;
};

/** Catálogo de procedimentos com busca (sem acento) e categorias. Usado no orçamento e na consulta. */
export function ProcedureCatalog<P extends CatalogProcedure>({ procedures, onPick, meta, actionLabel, autoFocus, listClassName }: Props<P>) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const categories = useMemo(() => [...new Set(procedures.map((p) => p.category).filter((c): c is string => Boolean(c)))].sort(), [procedures]);
  const list = useMemo(() => {
    const q = normalize(query.trim());
    return procedures.filter((p) => (!category || p.category === category) && (!q || normalize(p.name).includes(q)));
  }, [procedures, query, category]);

  return (
    <div className="space-y-3">
      <label className="relative block">
        <span className="sr-only">Buscar procedimento</span>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar procedimento"
          className="h-10 w-full rounded-lg border border-input bg-card pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 pointer-coarse:h-11"
        />
      </label>
      {categories.length ? (
        <div role="group" aria-label="Categorias" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          <button type="button" aria-pressed={category === null} onClick={() => setCategory(null)} className={chip(category === null)}>
            Todos
          </button>
          {categories.map((c) => (
            <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)} className={chip(category === c)}>
              {c}
            </button>
          ))}
        </div>
      ) : null}
      {list.length ? (
        <ul className={cn("-mx-1 max-h-80 overflow-y-auto", listClassName)}>
          {list.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onPick(p)}
                aria-label={actionLabel ? actionLabel(p) : `Incluir ${p.name}`}
                className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[0.8125rem] font-medium">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{p.applies_to_tooth ? "Por dente" : (p.category ?? "Geral")}</span>
                </span>
                <span className="text-[0.8125rem] text-muted-foreground tabular-nums">{meta(p)}</span>
                <Plus className="size-4 shrink-0 text-primary" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-4 text-center text-[0.8125rem] text-muted-foreground">Nenhum procedimento com esse nome.</p>
      )}
    </div>
  );
}
