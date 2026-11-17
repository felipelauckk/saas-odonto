import { AlertCircle } from "lucide-react";
import { cn } from "cn";

/**
 * Bloco de uma tela que não carregou: só ele mostra o aviso e o resto da
 * página continua funcionando. `what` completa a frase ("o resultado do mês").
 */
export function BlockError({ what, className }: { what: string; className?: string }) {
  return (
    <p role="alert" className={cn("flex items-center gap-2 rounded-lg bg-destructive-soft px-3 py-3 text-sm text-destructive", className)}>
      <AlertCircle className="size-4 shrink-0" aria-hidden />
      Não foi possível carregar {what}. Recarregue a página para tentar de novo.
    </p>
  );
}
