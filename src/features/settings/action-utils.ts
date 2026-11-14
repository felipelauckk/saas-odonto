import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";
import { z } from "zod";

import { withoutSecrets, type ActionState } from "@/lib/action-state";
import { subscriptionErrorMessage } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";
import { getSessionContext } from "@/features/tenancy/queries";
import { canManageClinic } from "@/features/tenancy/roles";

type ManagerContext =
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; clinicId: string }
  | { ok: false; state: ActionState };

/**
 * Confere que quem chama administra a clínica ativa. É só para dar uma
 * mensagem clara: a RLS barra a gravação de qualquer forma.
 */
export async function managerContext(): Promise<ManagerContext> {
  const session = await getSessionContext();
  if (!session?.clinic || !canManageClinic(session.clinic.role)) {
    return { ok: false, state: { status: "error", message: "Você não tem permissão para alterar as configurações." } };
  }
  return { ok: true, supabase: await createClient(), clinicId: session.clinic.id };
}

export function invalidState(error: z.ZodError, values: Record<string, string>): ActionState {
  return {
    status: "error",
    message: "Confira os campos destacados.",
    fieldErrors: z.flattenError(error).fieldErrors,
    values: withoutSecrets(values),
  };
}

/** Mensagem amigável para erros do banco. */
export function dbErrorState(error: PostgrestError | null, values?: Record<string, string>): ActionState {
  const blocked = subscriptionErrorMessage(error);
  if (blocked) return { status: "error", message: blocked, values };
  const message =
    error?.code === "23P01"
      ? "Este horário se sobrepõe a outro período do mesmo profissional."
      : error?.code === "23505"
        ? "Já existe um registro igual."
        : error?.code === "23503"
          ? "Um dos itens escolhidos não existe mais. Recarregue a página."
          : "Não foi possível salvar. Tente novamente.";
  return { status: "error", message, values };
}

/** Atualização que não afetou nenhuma linha = sem permissão ou registro inexistente. */
export const notFoundState: ActionState = {
  status: "error",
  message: "Registro não encontrado ou sem permissão para alterá-lo.",
};
