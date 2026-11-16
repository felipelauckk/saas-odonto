"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

import { visibleNavGroups } from "./nav-items";

type NavLinksProps = {
  canManage?: boolean;
  isDentist?: boolean;
  onNavigate?: () => void;
};

export function NavLinks({ canManage = false, isDentist = false, onNavigate }: NavLinksProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Menu principal" className="flex flex-col gap-5">
      {visibleNavGroups({ canManage, isDentist }).map((group) => (
        <div key={group.title} role="group" aria-labelledby={`nav-${group.title}`} className="flex flex-col gap-0.5">
          <div id={`nav-${group.title}`} className="px-3 pb-1.5 type-label text-sidebar-foreground/60">
            {group.title}
          </div>
          {group.items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-sidebar-foreground/75 transition-colors outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring pointer-coarse:h-11",
                  active && "bg-sidebar-accent font-semibold text-sidebar-accent-foreground",
                )}
              >
                <Icon className="size-4.5 shrink-0" strokeWidth={1.75} aria-hidden />
                {label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
