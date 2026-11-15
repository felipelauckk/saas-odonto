import type { ReactNode } from "react";

import { Brand } from "./brand";
import { NavLinks } from "./nav-links";

type SidebarProps = {
  /** Seletor de clínica, logo abaixo da marca. */
  top?: ReactNode;
  /** Menu do usuário, no rodapé. */
  bottom?: ReactNode;
  canManage?: boolean;
  isDentist?: boolean;
};

export function Sidebar({ top, bottom, canManage, isDentist }: SidebarProps) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col gap-6 border-r border-sidebar-border bg-sidebar px-3 py-5 lg:flex">
      <Brand />
      {top}
      <NavLinks canManage={canManage} isDentist={isDentist} />
      {bottom ? <div className="mt-auto">{bottom}</div> : null}
    </aside>
  );
}
