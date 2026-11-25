"use client";

import { useEffect, useId, useMemo, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { FileText, Search, User, UserPlus, type LucideIcon } from "lucide-react";
import { cn } from "cn";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { findPatients, type PatientOption } from "@/features/agenda/actions";

import { visibleNavGroups, type NavAccess } from "./nav-items";

const OPEN_EVENT = "arcada:open-search";

type Entry = { id: string; group: string; label: string; detail?: string | null; href: string; icon: LucideIcon };

const quickActions: Entry[] = [
  { id: "action-patient", group: "Ações", label: "Novo paciente", href: "/pacientes/novo", icon: UserPlus },
  { id: "action-quote", group: "Ações", label: "Novo orçamento", href: "/orcamentos/novo", icon: FileText },
];

function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

const noop = () => () => {};
function useIsMac() {
  return useSyncExternalStore(noop, () => /Mac|iPhone|iPad/.test(navigator.userAgent), () => true);
}

/** Botão "Buscar ou ir para…" do menu lateral. Abre a busca global. */
export function CommandMenuTrigger({ className }: { className?: string }) {
  const isMac = useIsMac();
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
      className={cn(
        "flex h-10 w-full items-center gap-2 rounded-lg border border-sidebar-border bg-muted/60 px-2.5 text-left text-[0.8125rem] font-medium whitespace-nowrap text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring pointer-coarse:h-11",
        className,
      )}
    >
      <Search className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 truncate">Buscar ou ir para…</span>
      <kbd className="ml-auto shrink-0 rounded-md pointer-coarse:hidden border border-border bg-card px-1 font-sans text-[0.625rem] font-medium">
        {isMac ? "⌘K" : "Ctrl K"}
      </kbd>
    </button>
  );
}

/**
 * Busca global (⌘K / Ctrl+K): pacientes por nome, CPF ou telefone, páginas do
 * menu e ações rápidas. Montada uma vez no layout.
 */
export function CommandMenu(access: NavAccess) {
  const router = useRouter();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState<{ query: string; items: PatientOption[] }>({ query: "", items: [] });
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  const trimmed = query.trim();
  useEffect(() => {
    if (trimmed.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void findPatients(trimmed).then((items) => {
        if (!cancelled) setPatients({ query: trimmed, items });
      });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed]);

  const entries = useMemo(() => {
    const term = normalize(trimmed);
    const pages: Entry[] = visibleNavGroups(access).flatMap((group) =>
      group.items.map((item) => ({ id: `page-${item.href}`, group: "Ir para", label: item.label, href: item.href, icon: item.icon })),
    );
    const matches = (entry: Entry) => !term || normalize(entry.label).includes(term);
    const patientEntries: Entry[] =
      trimmed.length >= 2 && patients.query === trimmed
        ? patients.items.map((p) => ({
            id: `patient-${p.id}`,
            group: "Pacientes",
            label: p.name,
            detail: p.detail,
            href: `/pacientes/${p.id}`,
            icon: User,
          }))
        : [];
    return [...patientEntries, ...quickActions.filter(matches), ...pages.filter(matches)];
  }, [access, trimmed, patients]);

  const searching = trimmed.length >= 2 && patients.query !== trimmed;
  const current = Math.min(activeIndex, Math.max(entries.length - 1, 0));

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery("");
      setActiveIndex(0);
    }
  }

  function go(entry: Entry) {
    changeOpen(false);
    router.push(entry.href);
  }

  function onInputKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current + 1) % Math.max(entries.length, 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current - 1 + entries.length) % Math.max(entries.length, 1));
    } else if (event.key === "Enter") {
      const entry = entries[current];
      if (entry) {
        event.preventDefault();
        go(entry);
      }
    }
  }

  const optionId = (index: number) => `${listId}-${index}`;

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent showCloseButton={false} className="top-[15vh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogTitle className="sr-only">Buscar ou ir para</DialogTitle>
        <div className="flex items-center gap-3 border-b px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={entries.length ? optionId(current) : undefined}
            aria-label="Buscar paciente, página ou ação"
            placeholder="Paciente (nome, CPF ou telefone), página ou ação"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onInputKey}
            className="h-13 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm"
          />
        </div>
        <div id={listId} role="listbox" aria-label="Resultados" className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
          {entries.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              {searching ? "Buscando…" : "Nada encontrado."}
            </p>
          ) : (
            entries.map((entry, index) => {
              const showGroup = index === 0 || entries[index - 1]?.group !== entry.group;
              const Icon = entry.icon;
              return (
                <div key={entry.id}>
                  {showGroup ? (
                    <div className="px-3 pt-2 pb-1.5 type-label text-muted-foreground" aria-hidden>
                      {entry.group}
                    </div>
                  ) : null}
                  <div
                    id={optionId(index)}
                    role="option"
                    aria-selected={index === current}
                    onMouseMove={() => setActiveIndex(index)}
                    onClick={() => go(entry)}
                    className={cn(
                      "flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm pointer-coarse:min-h-11",
                      index === current && "bg-accent text-accent-foreground",
                    )}
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="truncate font-medium">{entry.label}</span>
                    {entry.detail ? <span className="ml-auto truncate text-xs text-muted-foreground">{entry.detail}</span> : null}
                  </div>
                </div>
              );
            })
          )}
          {searching && entries.length > 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground" aria-live="polite">
              Buscando pacientes…
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
