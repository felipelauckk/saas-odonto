import type { Database } from "@/lib/supabase/database.types";

export type MemberRole = Database["public"]["Enums"]["member_role"];

export const roleLabels: Record<MemberRole, string> = {
  owner: "Proprietário",
  manager: "Gestor",
  dentist: "Dentista",
  receptionist: "Recepção",
};

export const memberRoles = ["owner", "manager", "dentist", "receptionist"] as const satisfies readonly MemberRole[];

/** Owner e manager administram a clínica (configurações, unidades, equipe). */
export function canManageClinic(role: MemberRole | null | undefined): boolean {
  return role === "owner" || role === "manager";
}
