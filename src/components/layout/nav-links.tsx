"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

import { navItems } from "./nav-items";

type NavLinksProps = {
  canManage?: boolean;
  isDentist?: boolean;
  onNavigate?: () => void;
};

export function NavLinks({ canManage = false, isDentist = false, onNavigate }: NavLinksProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Menu principal" className="flex flex-col gap-0.5">
      {navItems.filter((item) => (canManage || !item.managersOnly) && !(isDentist && item.frontDeskOnly)).map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium text-sidebar-foreground/75 transition-colors outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-sidebar-ring/40 pointer-coarse:h-11",
              active && "bg-sidebar-accent text-sidebar-accent-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
