import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { PageHeader } from "./page-header";

type SettingsHeaderProps = { title: string; description?: string; actions?: ReactNode; backHref?: string; backLabel?: string };

/** Cabeçalho das telas de Configurações, com link de volta. */
export function SettingsHeader({
  title,
  description,
  actions,
  backHref = "/configuracoes",
  backLabel = "Configurações",
}: SettingsHeaderProps) {
  return (
    <div className="space-y-3">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground pointer-coarse:min-h-11"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {backLabel}
      </Link>
      <PageHeader title={title} description={description} actions={actions} />
    </div>
  );
}
