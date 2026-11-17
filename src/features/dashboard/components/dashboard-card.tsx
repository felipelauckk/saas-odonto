import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "cn";

type DashboardCardProps = {
  id: string;
  title: string;
  description?: string;
  /** Link no canto (ex.: "Abrir agenda"). */
  link?: { href: string; label: string };
  className?: string;
  children: ReactNode;
};

/** Bloco do painel: título, descrição opcional, link no canto e conteúdo. */
export function DashboardCard({ id, title, description, link, className, children }: DashboardCardProps) {
  return (
    <section aria-labelledby={id} className={cn("flex min-w-0 flex-col gap-4 rounded-card border bg-card p-5 sm:p-6", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <h2 id={id} className="type-section">
            {title}
          </h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {link ? (
          <Link
            href={link.href}
            className="-my-2 inline-flex h-9 shrink-0 items-center rounded-md px-2 text-sm font-semibold text-primary outline-none hover:text-primary-hover focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:h-11"
          >
            {link.label}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** Erro de um bloco só (o resto do painel continua funcionando). */
export { BlockError } from "@/components/feedback/block-error";

/** Estado vazio compacto, dentro de um bloco. */
export function BlockEmpty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-muted px-3 py-6 text-center text-sm text-muted-foreground">{children}</p>;
}
