import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { cn } from "cn";

import { initials } from "@/lib/initials";

type Props = {
  /** Nome da clínica no cabeçalho; nulo em páginas de erro (link inválido). */
  clinicName: string | null;
  /** Linha abaixo do nome (unidade, "Link seguro"...). */
  detail?: string | null;
  /** Texto do rodapé (privacidade). */
  footer?: string;
  width?: "sm" | "md" | "lg";
  children: ReactNode;
};

const WIDTH = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-2xl" } as const;

/**
 * Moldura das páginas que o paciente abre sem login (agendar, assinar, portal,
 * check-in, captação): pensadas primeiro para o celular, com a marca da
 * clínica no topo e a linha de privacidade no rodapé.
 */
export function PublicShell({ clinicName, detail, footer = "Seus dados ficam protegidos pela LGPD e só a clínica tem acesso.", width = "md", children }: Props) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="border-b border-border-soft bg-card">
        <div className={cn("mx-auto flex w-full items-center gap-3 px-4 py-3.5", WIDTH[width])}>
          {clinicName ? (
            <>
              <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-avatar bg-brand-deep text-sm font-black text-brand-deep-foreground">
                {initials(clinicName)}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[0.9375rem] font-bold">{clinicName}</span>
                {detail ? <span className="truncate text-xs text-muted-foreground">{detail}</span> : null}
              </span>
            </>
          ) : (
            <span className="text-sm font-semibold text-muted-foreground">Arcada</span>
          )}
        </div>
      </header>
      <main className={cn("mx-auto w-full flex-1 space-y-6 px-4 py-6 sm:py-8", WIDTH[width])}>{children}</main>
      <footer className={cn("mx-auto flex w-full items-center justify-center gap-1.5 px-4 pt-2 pb-6 text-center text-xs text-muted-foreground", WIDTH[width])}>
        <Lock className="size-3 shrink-0" aria-hidden />
        {footer}
      </footer>
    </div>
  );
}

/** Mensagem de link inválido, expirado ou indisponível. */
export function PublicNotice({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border bg-card p-8 text-center">
      <span className="text-muted-foreground [&_svg]:size-8">{icon}</span>
      <h1 className="type-section">{title}</h1>
      {children ? <p className="text-sm text-muted-foreground">{children}</p> : null}
    </div>
  );
}
