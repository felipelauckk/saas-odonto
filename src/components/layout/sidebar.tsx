import type { ReactNode } from "react";

import { Brand } from "./brand";
import { CommandMenuTrigger } from "./command-menu";
import { NavLinks } from "./nav-links";

type SidebarProps = {
  /** Seletor de clínica e unidade, logo abaixo da marca. */
  top?: ReactNode;
  /** Menu do usuário, no rodapé. */
  bottom?: ReactNode;
  canManage?: boolean;
  isDentist?: boolean;
};

/** Conteúdo do menu lateral, usado no computador e na gaveta do celular. */
export function SidebarContent({ top, bottom, canManage, isDentist, onNavigate }: SidebarProps & { onNavigate?: () => void }) {
  return (
    <>
      <Brand variant="light" />
      {top}
      <CommandMenuTrigger />
      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <NavLinks canManage={canManage} isDentist={isDentist} onNavigate={onNavigate} />
      </div>
      {bottom ? <div className="border-t border-sidebar-border pt-3">{bottom}</div> : null}
    </>
  );
}

export function Sidebar(props: SidebarProps) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-62 flex-col gap-3.5 bg-sidebar px-3 py-4 [@media(max-height:800px)]:gap-2.5 [@media(max-height:800px)]:py-3 text-sidebar-foreground lg:flex">
      <SidebarContent {...props} />
    </aside>
  );
}
