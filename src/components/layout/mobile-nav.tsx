"use client";

import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { Brand } from "./brand";
import { NavLinks } from "./nav-links";

type MobileNavProps = {
  top?: ReactNode;
  bottom?: ReactNode;
  /** Ações à direita da barra (ex.: seletor de unidade). */
  actions?: ReactNode;
  canManage?: boolean;
};

export function MobileNav({ top, bottom, actions, canManage }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={<Button variant="ghost" size="icon" aria-label="Abrir menu" />}
        >
          <Menu />
        </SheetTrigger>
        <SheetContent side="left" className="w-72 gap-6 bg-sidebar px-3 py-5">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <Brand />
          {top}
          <NavLinks canManage={canManage} onNavigate={() => setOpen(false)} />
          {bottom ? <div className="mt-auto">{bottom}</div> : null}
        </SheetContent>
      </Sheet>
      <Brand />
      {actions ? <div className="ml-auto">{actions}</div> : null}
    </header>
  );
}
