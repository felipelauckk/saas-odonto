import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";

import type { Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export const hasSupabase = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type TestUser = {
  email: string;
  password: string;
  clinicName: string;
  clinicId: string;
  cleanup: () => Promise<void>;
};

/** Cria um usuário confirmado com a própria clínica (como no cadastro público). */
export async function createTestUser(): Promise<TestUser> {
  const id = randomUUID().slice(0, 8);
  const email = `e2e-${id}@example.com`;
  const password = `E2e-${randomUUID()}`;
  const clinicName = `Clínica E2E ${id}`;
  const client = admin();

  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Pessoa Teste", clinic_name: clinicName },
  });
  if (error) throw error;
  const userId = data.user.id;
  const { data: member, error: memberError } = await client
    .from("clinic_members")
    .select("clinic_id")
    .eq("user_id", userId)
    .single();
  if (memberError) throw memberError;

  return {
    email,
    password,
    clinicName,
    clinicId: member.clinic_id,
    async cleanup() {
      const { data: members } = await client.from("clinic_members").select("clinic_id").eq("user_id", userId);
      const configTables = [
        "appointments",
      "schedule_blocks",
      "professional_schedules",
        "professionals",
        "chairs",
        "procedures",
        "payment_methods",
        "anamnesis_templates",
      "patients",
      ];
      for (const { clinic_id } of members ?? []) {
        for (const table of configTables) await client.from(table).delete().eq("clinic_id", clinic_id);
        await client.from("clinic_members").delete().eq("clinic_id", clinic_id);
        await client.from("profiles").update({ active_clinic_id: null }).eq("active_clinic_id", clinic_id);
        await client.from("units").delete().eq("clinic_id", clinic_id);
        await client.from("clinics").delete().eq("id", clinic_id);
      }
      await client.auth.admin.deleteUser(userId);
    },
  };
}

export async function signIn(page: Page, user: TestUser) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(user.email);
  await page.getByLabel("Senha").fill(user.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/painel$/);
}

/** Profissional com expediente de segunda a sexta (8h–18h) e um paciente, para testar a agenda. */
export async function seedAgenda(user: TestUser) {
  const client = admin();
  const { data: unit } = await client.from("units").select("id").eq("clinic_id", user.clinicId).single();
  const { data: pro } = await client
    .from("professionals")
    .insert({ clinic_id: user.clinicId, name: "Dra. Ana", color: "#2563eb" })
    .select("id")
    .single();
  await client.from("professional_schedules").insert(
    [1, 2, 3, 4, 5].map((weekday) => ({
      clinic_id: user.clinicId,
      unit_id: unit!.id,
      professional_id: pro!.id,
      weekday,
      start_time: "08:00",
      end_time: "18:00",
    })),
  );
  const { data: patient } = await client
    .from("patients")
    .insert({ clinic_id: user.clinicId, full_name: "Paciente Agenda", phone: "11988887777", whatsapp: "11988887777" })
    .select("id")
    .single();
  return { unitId: unit!.id, professionalId: pro!.id, patientId: patient!.id };
}
