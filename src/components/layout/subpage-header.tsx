import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "cn";

import { PageHeader } from "./page-header";

type SubpageHeaderProps = { title: string; description?: string; actions?: ReactNode; backHref?: string; backLabel?: string };

/** Cabeçalho de subpágina, com link de volta. */
export function SubpageHeader({
  title,
  description,
  actions,
  backHref = "/configuracoes",
  backLabel = "Configurações",
}: SubpageHeaderProps) {
  return (
    <div className="space-y-3">
      <Link
        href={backHref}
        // Em Configurações, no computador, o menu das áreas ao lado já leva de volta.
        className={cn(
          "inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground pointer-coarse:min-h-11",
          backHref === "/configuracoes" && "lg:hidden",
        )}
      >
        <ChevronLeft className="size-4" aria-hidden />
        {backLabel}
      </Link>
      <PageHeader title={title} description={description} actions={actions} />
    </div>
  );
}
