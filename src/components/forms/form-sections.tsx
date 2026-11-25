import type { ReactNode } from "react";
import { cn } from "cn";

/**
 * Cartão de formulário em blocos (Redesign 2.0): cada bloco tem título e explicação à esquerda
 * e os campos à direita; no celular, um embaixo do outro. Use como classe de um <form> ou <div>.
 */
export const formSectionsClass =
  "rounded-card border bg-card px-5 shadow-card sm:px-7 [&>[data-slot=form-section]:first-child]:border-t-0 [&>[data-slot=form-section]:first-child]:pt-5 sm:[&>[data-slot=form-section]:first-child]:pt-6";

export function FormSections({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn(formSectionsClass, className)}>{children}</div>;
}

/** Um bloco: o título vira um rótulo de grupo para os leitores de tela. */
export function FormSection({ id, title, description, className, children }: { id: string; title: string; description?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section
      data-slot="form-section"
      aria-labelledby={id}
      className={cn("grid gap-x-10 gap-y-4 border-t py-6 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]", className)}
    >
      <div className="space-y-1">
        <h2 id={id} className="text-[0.9375rem] font-bold">
          {title}
        </h2>
        {description ? <p className="text-[0.8125rem] text-muted-foreground">{description}</p> : null}
      </div>
      <div className="min-w-0 space-y-4">{children}</div>
    </section>
  );
}

/** Rodapé com o botão de salvar, alinhado à direita. */
export function FormSectionsFooter({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3 border-t py-5">
      {note ? <div className="mr-auto min-w-0 text-[0.8125rem] text-muted-foreground">{note}</div> : null}
      {children}
    </div>
  );
}
