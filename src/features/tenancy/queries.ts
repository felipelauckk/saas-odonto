import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";

import { ACTIVE_UNIT_COOKIE } from "./constants";
import type { MemberRole } from "./roles";

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

/**
 * Usuário logado, clínicas, clínica ativa (definida no banco), papel e unidades.
 * Uma consulta por requisição (cache do React). Null se não houver login.
 */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const userId = auth.user.id;

  const [profileRes, membershipsRes, clinicsRes, currentRes] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    supabase.from("clinic_members").select("id, clinic_id, role").eq("user_id", userId).eq("active", true),
    supabase.from("clinics").select("id, name, subscription_status, trial_ends_at").order("name"),
    supabase.rpc("current_clinic_id"),
  ]);

  const roleByClinic = new Map((membershipsRes.data ?? []).map((m) => [m.clinic_id, m.role]));
  const clinicRows = (clinicsRes.data ?? []).filter((c) => roleByClinic.has(c.id));
  const clinics: ClinicOption[] = clinicRows.map((c) => ({
    id: c.id,
    name: c.name,
    role: roleByClinic.get(c.id)!,
  }));

  const user = {
    id: userId,
    email: auth.user.email ?? "",
    fullName: profileRes.data?.full_name ?? null,
  };

  const currentId = currentRes.data;
  const current = clinicRows.find((c) => c.id === currentId);
  if (!current) return { user, clinics, clinic: null, units: [], activeUnit: null };

  const memberId = (membershipsRes.data ?? []).find((m) => m.clinic_id === current.id)?.id;

  // A RLS já devolve só as unidades permitidas da clínica ativa.
  const [{ data: unitRows }, { data: accessState }, { data: professional }] = await Promise.all([
    supabase.from("units").select("id, name").eq("active", true).order("created_at"),
    supabase.rpc("clinic_access_state", { _clinic_id: current.id }),
    memberId
      ? supabase.from("professionals").select("cro").eq("member_id", memberId).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const units = unitRows ?? [];

  const cookieStore = await cookies();
  const savedUnit = cookieStore.get(ACTIVE_UNIT_COOKIE)?.value;
  const activeUnit = units.find((u) => u.id === savedUnit) ?? units[0] ?? null;

  return {
    user,
    clinics,
    clinic: {
      id: current.id,
      name: current.name,
      role: roleByClinic.get(current.id)!,
      subscriptionStatus: current.subscription_status,
      trialEndsAt: current.trial_ends_at,
      accessState: accessState === "read_only" || accessState === "grace" ? accessState : "ok",
      cro: professional?.cro ?? null,
    },
    units,
    activeUnit,
  };
});
