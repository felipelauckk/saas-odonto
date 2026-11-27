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
import { SidebarContent } from "./sidebar";

type MobileNavProps = {
  bell?: ReactNode;
  hasNews?: boolean;
  top?: ReactNode;
  bottom?: ReactNode;
  canManage?: boolean;
  isDentist?: boolean;
};

export function MobileNav({ top, bottom, bell, hasNews, canManage, isDentist }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={<Button variant="ghost" size="icon" aria-label="Abrir menu" />}
        >
          <Menu />
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-72 gap-4.5 border-none bg-sidebar px-3 py-5.5 text-sidebar-foreground [&_[data-slot=sheet-close]]:text-sidebar-foreground [&_[data-slot=sheet-close]]:hover:bg-sidebar-accent"
        >
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SidebarContent
            top={top}
            bottom={bottom}
            canManage={canManage}
            isDentist={isDentist}
            hasNews={hasNews}
            onNavigate={() => setOpen(false)}
          />
        </SheetContent>
      </Sheet>
      <Brand />
      {bell ? <div className="ml-auto">{bell}</div> : null}
    </header>
  );
}
