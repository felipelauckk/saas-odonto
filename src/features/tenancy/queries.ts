import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

import { ACTIVE_UNIT_COOKIE } from "./constants";
import { memberRoles, type MemberRole } from "./roles";

export type ClinicOption = { id: string; name: string; role: MemberRole };
export type UnitOption = { id: string; name: string };

export type SessionContext = {
  user: { id: string; email: string; fullName: string | null };
  clinics: ClinicOption[];
  /** Null quando o usuário não é membro ativo de nenhuma clínica. */
  clinic:
    | (ClinicOption & {
        subscriptionStatus: string;
        trialEndsAt: string | null;
        /** ok | grace (atraso dentro da carência) | read_only */
        accessState: "ok" | "grace" | "read_only";
        /** CRO do profissional ligado ao usuário nesta clínica, se houver. */
        cro: string | null;
      })
    | null;
  units: UnitOption[];
  activeUnit: UnitOption | null;
};

const sessionRowSchema = z.object({
  full_name: z.string().nullable(),
  clinics: z.array(
    z.object({ id: z.string(), name: z.string(), role: z.enum(memberRoles), subscription_status: z.string(), trial_ends_at: z.string().nullable() }),
  ),
  current_clinic_id: z.string().nullable(),
  units: z.array(z.object({ id: z.string(), name: z.string() })),
  access_state: z.string().nullable(),
  cro: z.string().nullable(),
});

/**
 * Usuário logado, clínicas, clínica ativa (definida no banco), papel e unidades.
 * Roda a cada clique: o login é conferido pela assinatura do token (sem ir ao
 * servidor de autenticação) e o resto vem numa chamada só (`session_context`).
 * Uma vez por requisição (cache do React). Null se não houver login.
 */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const claims = auth?.claims;
  if (!claims?.sub) return null;

  const { data, error } = await supabase.rpc("session_context");
  if (error) throw new Error(`Não foi possível carregar a sessão: ${error.message}`);
  const row = sessionRowSchema.parse(data);

  const user = { id: claims.sub, email: typeof claims.email === "string" ? claims.email : "", fullName: row.full_name };
  const clinics: ClinicOption[] = row.clinics.map((c) => ({ id: c.id, name: c.name, role: c.role }));
  const current = row.clinics.find((c) => c.id === row.current_clinic_id);
  if (!current) return { user, clinics, clinic: null, units: [], activeUnit: null };

  const units = row.units;
  const cookieStore = await cookies();
  const savedUnit = cookieStore.get(ACTIVE_UNIT_COOKIE)?.value;
  const activeUnit = units.find((u) => u.id === savedUnit) ?? units[0] ?? null;

  return {
    user,
    clinics,
    clinic: {
      id: current.id,
      name: current.name,
      role: current.role,
      subscriptionStatus: current.subscription_status,
      trialEndsAt: current.trial_ends_at,
      accessState: row.access_state === "read_only" || row.access_state === "grace" ? row.access_state : "ok",
      cro: row.cro,
    },
    units,
    activeUnit,
  };
});
