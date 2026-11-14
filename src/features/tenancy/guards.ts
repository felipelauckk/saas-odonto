import "server-only";

import { redirect } from "next/navigation";

import { getSessionContext, type SessionContext } from "./queries";
import { canManageClinic } from "./roles";

type ActiveSession = SessionContext & { clinic: NonNullable<SessionContext["clinic"]> };

/** Garante login e clínica ativa; senão manda para o login/painel. */
export async function requireClinic(): Promise<ActiveSession> {
  const session = await getSessionContext();
  if (!session) redirect("/entrar");
  if (!session.clinic) redirect("/painel");
  return session as ActiveSession;
}

/** Só owner e manager. Demais papéis voltam ao painel. */
export async function requireManager(): Promise<ActiveSession> {
  const session = await requireClinic();
  if (!canManageClinic(session.clinic.role)) redirect("/painel");
  return session;
}
