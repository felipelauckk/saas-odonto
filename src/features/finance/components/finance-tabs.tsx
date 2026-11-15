"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

export function FinanceTabs({ showCash, showManagement = false, showCommissions = false }: { showCash: boolean; showManagement?: boolean; showCommissions?: boolean }) {
  const pathname = usePathname();
  const tabs = [
    { href: "/financeiro", label: "Contas a receber", active: pathname === "/financeiro" },
    ...(showManagement ? [{ href: "/financeiro/pagar", label: "Contas a pagar", active: pathname.startsWith("/financeiro/pagar") }] : []),
    ...(showCash ? [{ href: "/financeiro/caixa", label: "Caixa do dia", active: pathname.startsWith("/financeiro/caixa") }] : []),
    ...(showManagement
      ? [
          { href: "/financeiro/fluxo", label: "Fluxo de caixa", active: pathname.startsWith("/financeiro/fluxo") },
          { href: "/financeiro/dre", label: "DRE", active: pathname.startsWith("/financeiro/dre") },
          { href: "/financeiro/conciliacao", label: "Conciliação", active: pathname.startsWith("/financeiro/conciliacao") },
        ]
      : []),
    ...(showCommissions ? [{ href: "/financeiro/comissoes", label: "Comissões", active: pathname.startsWith("/financeiro/comissoes") }] : []),
  ];
  if (tabs.length < 2) return null;
  return (
    <nav aria-label="Financeiro" className="-mx-4 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1">
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
