"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { cn } from "cn";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { patientSources, sourceLabels } from "../labels";

/** Busca e filtros da lista de pacientes. Tudo fica na URL (dá para compartilhar e voltar). */
export function PatientFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const status = params.get("status") === "archived" ? "archived" : "active";
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

  // Busca enquanto digita, com uma pequena espera.
  useEffect(() => {
    if (query === (params.get("q") ?? "")) return;
    const timer = setTimeout(() => navigate({ q: query.trim() || null }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const tab = (value: "active" | "archived", label: string) => (
    <button
      type="button"
      aria-pressed={status === value}
      onClick={() => navigate({ status: value === "active" ? null : value })}
      className={cn(
        "h-8 rounded-md px-3 text-sm font-medium transition-colors pointer-coarse:h-11",
        status === value ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );

  const sourceItems = [{ value: "all", label: "Todas as origens" }, ...patientSources.map((s) => ({ value: s, label: sourceLabels[s] }))];

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center">
      <div className="relative flex-1">
        {pending ? (
          <Loader2 className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />
        ) : (
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        )}
        <Input
          type="search"
          placeholder="Buscar por nome, CPF ou telefone"
          aria-label="Buscar paciente"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-8"
        />
      </div>
      <div className="flex gap-3">
        <div className="inline-flex rounded-lg bg-muted p-1" role="group" aria-label="Situação">
          {tab("active", "Ativos")}
          {tab("archived", "Arquivados")}
        </div>
        <Select items={sourceItems} value={source} onValueChange={(value) => navigate({ source: value === "all" ? null : String(value) })}>
          <SelectTrigger aria-label="Origem" className="w-44 data-[size=default]:h-10 pointer-coarse:data-[size=default]:h-11">
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
    </div>
  );
}
