"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

import { SETTINGS_GROUPS } from "../sections";

/** Menu das seções de Configurações (lateral no desktop, lista na página inicial no celular). */
export function SettingsMenu({ withDescriptions = false, aiEnabled = false }: { withDescriptions?: boolean; aiEnabled?: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Seções das configurações" className="space-y-5">
      {SETTINGS_GROUPS.map((g) => (
        <div key={g.title} className="space-y-1">
          <h2 className="px-3 type-label text-muted-foreground">{g.title}</h2>
          <ul>
            {g.sections.filter((s) => aiEnabled || !s.ai).map((s) => {
              const on = pathname === s.href || pathname.startsWith(`${s.href}/`);
              return (
                <li key={s.href}>
                  <Link
                    href={s.href}
                    aria-current={on ? "page" : undefined}
                    className={cn(
                      "flex min-h-10 flex-col justify-center rounded-lg px-3 py-1.5 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/40 pointer-coarse:min-h-11",
                      on ? "bg-card font-semibold text-accent-foreground shadow-segment" : "hover:bg-muted",
                    )}
                  >
                    {s.title}
                    {withDescriptions ? <span className="text-xs font-normal text-muted-foreground">{s.description}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
