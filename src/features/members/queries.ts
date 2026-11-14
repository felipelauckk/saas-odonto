import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { MemberRole } from "@/features/tenancy/roles";

export type MemberRow = {
  id: string;
  userId: string;
  fullName: string | null;
  email: string | null;
  role: MemberRole;
  active: boolean;
  /** Unidades permitidas (vazio = todas). */
  unitIds: string[];
  /** Convite enviado e ainda não aceito. */
  pending: boolean;
};

/**
 * Equipe da clínica ativa. A lista vem da RLS (só a clínica ativa); o admin
 * client só completa o e-mail de usuários que já estão nessa lista.
 */
export async function listMembers(): Promise<MemberRow[]> {
  const supabase = await createClient();
  const { data: clinicId } = await supabase.rpc("current_clinic_id");
  if (!clinicId) return [];

  const { data: members, error } = await supabase
    .from("clinic_members")
    .select("id, user_id, role, active, unit_ids, created_at")
    .eq("clinic_id", clinicId)
    .order("created_at");
  if (error) throw error;
  if (!members.length) return [];

  const userIds = members.map((m) => m.user_id);
  const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const admin = createAdminClient();
  const users = await Promise.all(userIds.map((id) => admin.auth.admin.getUserById(id)));
  const authById = new Map(
    users.flatMap(({ data }) => (data.user ? [[data.user.id, data.user] as const] : [])),
  );

  return members.map((m) => {
    const authUser = authById.get(m.user_id);
    return {
      id: m.id,
      userId: m.user_id,
      fullName: nameById.get(m.user_id) ?? null,
      email: authUser?.email ?? null,
      role: m.role,
      active: m.active,
      unitIds: m.unit_ids,
      pending: Boolean(authUser && !authUser.last_sign_in_at),
    };
  });
}
