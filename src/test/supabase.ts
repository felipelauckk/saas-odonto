/**
 * Ajudantes para testes que falam com o Supabase real.
 * Cada teste cria os próprios usuários/clínicas e chama cleanup() no fim.
 */
import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

export type Client = SupabaseClient<Database>;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const hasSupabase = Boolean(url && anonKey && serviceKey);

const noSession = { auth: { autoRefreshToken: false, persistSession: false } };

export function adminClient(): Client {
  return createClient<Database>(url!, serviceKey!, noSession);
}

export function anonClient(): Client {
  return createClient<Database>(url!, anonKey!, noSession);
}

export function createTestEnv(prefix: string) {
  const admin = adminClient();
  const password = `Teste-${randomUUID()}`;
  const runId = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  const clinicIds = new Set<string>();

  const emailFor = (label: string) => `${prefix}-${label}-${runId}@example.com`;

  async function signIn(label: string): Promise<Client> {
    const client = createClient<Database>(url!, anonKey!, noSession);
    const { error } = await client.auth.signInWithPassword({ email: emailFor(label), password });
    if (error) throw error;
    return client;
  }

  /** Cria usuário; com clinicName, nasce como owner da própria clínica. */
  async function createUser(label: string, clinicName?: string) {
    const { data, error } = await admin.auth.admin.createUser({
      email: emailFor(label),
      password,
      email_confirm: true,
      user_metadata: { full_name: `Teste ${label}`, ...(clinicName ? { clinic_name: `${clinicName} ${runId}` } : {}) },
    });
    if (error) throw error;
    userIds.push(data.user.id);

    let clinicId: string | null = null;
    if (clinicName) {
      const { data: member, error: memberError } = await admin
        .from("clinic_members")
        .select("clinic_id")
        .eq("user_id", data.user.id)
        .single();
      if (memberError) throw memberError;
      clinicId = member.clinic_id;
      clinicIds.add(clinicId);
    }
    return { userId: data.user.id, clinicId, clinicName: clinicName ? `${clinicName} ${runId}` : null };
  }

  /** Adiciona um usuário existente à clínica com o papel dado. */
  async function addMember(clinicId: string, userId: string, role: Database["public"]["Enums"]["member_role"]) {
    const { data, error } = await admin
      .from("clinic_members")
      .insert({ clinic_id: clinicId, user_id: userId, role })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  }

  async function cleanup() {
    const tables = [
      "clinical_notes",
      "anamneses",
      "tooth_records",
      "patient_files",
      "appointments",
      "schedule_blocks",
      "professional_schedules",
      "professionals",
      "chairs",
      "procedures",
      "payment_methods",
      "anamnesis_templates",
      "patients",
    ] as const;
    for (const id of clinicIds) {
      const { data: files } = await admin.from("patient_files").select("storage_path").eq("clinic_id", id);
      if (files?.length) await admin.storage.from("clinic").remove(files.map((f) => f.storage_path));
      for (const table of tables) await admin.from(table).delete().eq("clinic_id", id);
      await admin.storage.from("clinic").list(`${id}/logo`).then(async ({ data }) => {
        if (data?.length) await admin.storage.from("clinic").remove(data.map((f) => `${id}/logo/${f.name}`));
      });
      await admin.from("clinic_members").delete().eq("clinic_id", id);
      await admin.from("profiles").update({ active_clinic_id: null }).eq("active_clinic_id", id);
      await admin.from("units").delete().eq("clinic_id", id);
      await admin.from("clinics").delete().eq("id", id);
    }
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  }

  return { admin, runId, createUser, addMember, signIn, cleanup };
}
