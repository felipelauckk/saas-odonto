import type { ReactNode } from "react";
import Link from "next/link";
import { CircleHelp, Sparkles } from "lucide-react";

import { Brand } from "./brand";
import { CommandMenuTrigger } from "./command-menu";
import { NavLinks } from "./nav-links";

type SidebarProps = {
  /** Sino das notificações, ao lado da busca. */
  bell?: ReactNode;
  /** Há novidade que a pessoa ainda não viu (ponto no item "Novidades"). */
  hasNews?: boolean;
  /** Seletor de clínica e unidade, logo abaixo da marca. */
  top?: ReactNode;
  /** Menu do usuário, no rodapé. */
  bottom?: ReactNode;
  canManage?: boolean;
  isDentist?: boolean;
};

/** Conteúdo do menu lateral, usado no computador e na gaveta do celular. */
export function SidebarContent({ top, bottom, bell, hasNews, canManage, isDentist, onNavigate }: SidebarProps & { onNavigate?: () => void }) {
  return (
    <>
      <Brand />
      {top}
      <div className="flex items-center gap-2">
        <CommandMenuTrigger className="min-w-0 flex-1" />
        {bell}
      </div>
      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <NavLinks canManage={canManage} isDentist={isDentist} onNavigate={onNavigate} />
      </div>
      <div className="flex gap-1 text-[0.8125rem] font-medium text-muted-foreground">
        <Link href="/ajuda" onClick={onNavigate} className="flex h-8 items-center gap-1.5 rounded-md px-2 hover:bg-sidebar-accent hover:text-foreground pointer-coarse:h-11">
          <CircleHelp className="size-4" aria-hidden />
          Ajuda
        </Link>
        <Link href="/novidades" onClick={onNavigate} className="flex h-8 items-center gap-1.5 rounded-md px-2 hover:bg-sidebar-accent hover:text-foreground pointer-coarse:h-11">
          <Sparkles className="size-4" aria-hidden />
          Novidades
          {hasNews ? (
            <>
              <span className="size-2 rounded-full bg-primary" aria-hidden />
              <span className="sr-only">(há novidade)</span>
            </>
          ) : null}
        </Link>
      </div>
      {bottom ? <div className="border-t border-sidebar-border pt-3">{bottom}</div> : null}
    </>
  );
}

export function Sidebar(props: SidebarProps) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-62 flex-col gap-3.5 border-r border-sidebar-border bg-sidebar px-3 py-4 [@media(max-height:800px)]:gap-2.5 [@media(max-height:800px)]:py-3 text-sidebar-foreground lg:flex">
      <SidebarContent {...props} />
    </aside>
  );
}
