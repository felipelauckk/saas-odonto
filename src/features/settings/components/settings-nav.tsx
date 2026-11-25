"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

import { findSettingsArea, isSectionActive, visibleSettingsAreas } from "../sections";

/** Menu das 7 áreas, fixo à esquerda no computador. A área aberta mostra as telas dela logo abaixo. */
export function SettingsNav({ aiEnabled }: { aiEnabled: boolean }) {
  const pathname = usePathname();
  const areas = visibleSettingsAreas(aiEnabled);
  const current = findSettingsArea(areas, pathname);

  return (
    <nav aria-label="Áreas das configurações" className="hidden w-64 shrink-0 lg:sticky lg:top-6 lg:block">
      <ul className="flex flex-col gap-1">
        {areas.map((area) => {
          const open = area.key === current?.key;
          const Icon = area.icon;
          return (
            <li key={area.key}>
              <Link
                href={area.sections[0]!.href}
                aria-current={open && area.sections.length === 1 ? "page" : undefined}
                className={cn(
                  "flex min-h-14 items-center gap-3 rounded-xl border px-2.5 py-2 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                  open ? "border-border bg-card font-bold shadow-card" : "border-transparent font-semibold hover:bg-card/70",
                )}
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-[0.6875rem]",
                    open ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                  aria-hidden
                >
                  <Icon className="size-4.25" strokeWidth={1.9} />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span>{area.title}</span>
                  <span className="truncate text-xs font-normal text-muted-foreground">{area.hint}</span>
                </span>
              </Link>
              {open && area.sections.length > 1 ? (
                <ul aria-label={area.title} className="flex flex-col gap-0.5 pt-1 pb-2 pl-14">
                  {area.sections.map((s) => {
                    const active = isSectionActive(pathname, s.href);
                    return (
                      <li key={s.href}>
                        <Link
                          href={s.href}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex min-h-9 items-center rounded-lg px-2.5 text-[0.8125rem] outline-none focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:min-h-11",
                            active ? "bg-accent font-bold text-accent-foreground" : "font-medium text-muted-foreground hover:bg-card hover:text-foreground",
                          )}
                        >
                          {s.title}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** No celular e no tablet: abas com as telas da área aberta, acima do conteúdo. */
export function SettingsAreaTabs({ aiEnabled }: { aiEnabled: boolean }) {
  const pathname = usePathname();
  const area = findSettingsArea(visibleSettingsAreas(aiEnabled), pathname);
  if (!area || area.sections.length < 2) return null;

  return (
    <nav aria-label={`Telas de ${area.title}`} className="-mx-4 mb-5 overflow-x-auto px-4 lg:hidden">
      <ul className="flex w-max gap-1 rounded-xl border bg-card p-1">
        {area.sections.map((s) => {
          const active = isSectionActive(pathname, s.href);
          return (
            <li key={s.href}>
              <Link
                href={s.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center rounded-lg px-3.5 text-[0.8125rem] whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active ? "bg-foreground font-semibold text-background" : "font-medium text-muted-foreground hover:text-foreground",
                )}
              >
                {s.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
