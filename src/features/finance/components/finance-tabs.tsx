"use client";

import { usePathname } from "next/navigation";
import { TabNav } from "@/components/app/tab-nav";

export function FinanceTabs({ showCash, showManagement = false, showCommissions = false }: { showCash: boolean; showManagement?: boolean; showCommissions?: boolean }) {
  const pathname = usePathname();
  const tabs = [
    { href: "/financeiro", label: "Contas a receber", active: pathname === "/financeiro" },
    ...(showManagement ? [{ href: "/financeiro/pagar", label: "Contas a pagar", active: pathname.startsWith("/financeiro/pagar") }] : []),
    ...(showCash ? [{ href: "/financeiro/caixa", label: "Caixa do dia", active: pathname.startsWith("/financeiro/caixa") }] : []),
    ...(showCash ? [{ href: "/financeiro/notas", label: "Notas fiscais", active: pathname.startsWith("/financeiro/notas") }] : []),
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
  return <TabNav label="Financeiro" tabs={tabs} />;
}
