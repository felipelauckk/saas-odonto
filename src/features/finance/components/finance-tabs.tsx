"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

export function FinanceTabs({ showCash }: { showCash: boolean }) {
  const pathname = usePathname();
  const tabs = [
    { href: "/financeiro", label: "Contas a receber", active: pathname === "/financeiro" },
    ...(showCash ? [{ href: "/financeiro/caixa", label: "Caixa do dia", active: pathname.startsWith("/financeiro/caixa") }] : []),
  ];
  if (tabs.length < 2) return null;
  return (
    <nav aria-label="Financeiro" className="border-b">
      <ul className="flex gap-1">
        {tabs.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              aria-current={t.active ? "page" : undefined}
              className={cn(
                "-mb-px flex h-10 items-center border-b-2 px-3 text-sm font-medium pointer-coarse:h-11",
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
