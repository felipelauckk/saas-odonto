import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { visibleSettingsAreas } from "../sections";

/** Página inicial no celular e no tablet: as 7 áreas em lista (no computador o menu fica à esquerda). */
export function SettingsAreaList({ aiEnabled }: { aiEnabled: boolean }) {
  return (
    <nav aria-label="Áreas das configurações" className="lg:hidden">
      <ul className="divide-y overflow-hidden rounded-card border bg-card shadow-card">
        {visibleSettingsAreas(aiEnabled).map((area) => {
          const Icon = area.icon;
          return (
            <li key={area.key}>
              <Link
                href={area.sections[0]!.href}
                className="flex min-h-16 items-center gap-3 px-4 py-3 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[0.6875rem] bg-muted text-muted-foreground" aria-hidden>
                  <Icon className="size-4.25" strokeWidth={1.9} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-semibold">{area.title}</span>
                  <span className="text-xs text-muted-foreground">{area.sections.map((s) => s.title).join(" · ")}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
