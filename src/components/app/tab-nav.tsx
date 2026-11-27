import Link from "next/link";
import { cn } from "cn";

export type TabItem = { href: string; label: string; active: boolean };

/**
 * Abas de navegação: sublinhado petróleo de 2px no ativo. No celular rolam de
 * lado (sem barra visível); do tablet para cima quebram de linha se não couberem.
 */
export function TabNav({ label, tabs }: { label: string; tabs: readonly TabItem[] }) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto border-b border-border px-4 [scrollbar-width:none] sm:mx-0 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
      <ul className="flex min-w-max gap-0.5 sm:min-w-0 sm:flex-wrap">
        {tabs.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              aria-current={t.active ? "page" : undefined}
              className={cn(
                "-mb-px flex h-11 items-center border-b-2 px-2.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                t.active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
