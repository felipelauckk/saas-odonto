import Link from "next/link";
import { CircleAlert, Clock } from "lucide-react";

import { daysUntil } from "@/lib/dates";

type Props = {
  accessState: "ok" | "grace" | "read_only";
  subscriptionStatus: string;
  trialEndsAt: string | null;
  canManage: boolean;
};

/** Aviso fixo de assinatura: fim do teste próximo, atraso e modo somente leitura. */
export function SubscriptionBanner({ accessState, subscriptionStatus, trialEndsAt, canManage }: Props) {
  const link = canManage ? (
    <Link href="/configuracoes/assinatura" className="font-medium underline underline-offset-4">
      {accessState === "read_only" ? "Regularizar assinatura" : "Ver assinatura"}
    </Link>
  ) : null;

  if (accessState === "read_only") {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm sm:px-8">
        <CircleAlert className="size-4 text-destructive" aria-hidden />
        <span>
          <strong className="font-medium">Modo somente leitura.</strong>{" "}
          {subscriptionStatus === "trialing" ? "O período de teste terminou." : subscriptionStatus === "canceled" ? "A assinatura foi cancelada." : "Há um pagamento em atraso."}{" "}
          {canManage ? "Os dados continuam disponíveis para consulta." : "Fale com o responsável pela clínica."}
        </span>
        {link}
      </div>
    );
  }

  if (accessState === "grace") {
    return (
      <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-amber-300/60 bg-amber-50 px-4 py-2.5 text-sm text-amber-950 sm:px-8 dark:bg-amber-500/10 dark:text-amber-100">
        <CircleAlert className="size-4" aria-hidden />
        <span>Pagamento da assinatura em atraso. Após 7 dias, o sistema entra em modo somente leitura.</span>
        {link}
      </div>
    );
  }

  if (subscriptionStatus === "trialing" && trialEndsAt) {
    const daysLeft = daysUntil(trialEndsAt);
    if (daysLeft <= 5 && canManage) {
      return (
        <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b bg-muted/50 px-4 py-2.5 text-sm sm:px-8">
          <Clock className="size-4 text-muted-foreground" aria-hidden />
          <span>
            {daysLeft <= 0 ? "Seu teste termina hoje." : `Faltam ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"} de teste grátis.`}
          </span>
          {link}
        </div>
      );
    }
  }
  return null;
}
