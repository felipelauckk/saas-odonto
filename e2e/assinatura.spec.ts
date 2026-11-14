import { expect, test } from "@playwright/test";

import { admin, createTestUser, hasSupabase, signIn, type TestUser } from "./support/test-user";

test.skip(!hasSupabase, "Precisa do Supabase configurado no .env.local");

let user: TestUser;

test.beforeEach(async () => {
  user = await createTestUser();
});

let planName = "";

test.afterEach(async () => {
  if (planName) await admin().from("plans").delete().eq("name", planName);
  planName = "";
  await admin().from("platform_admins").delete().eq("user_id", (await admin().rpc("find_user_id_by_email", { _email: user.email })).data!);
  await user.cleanup();
});

test("teste vencido: aviso fixo e criação bloqueada, leitura continua", async ({ page }) => {
  await admin().from("patients").insert({ clinic_id: user.clinicId, full_name: "Paciente Antigo" });
  await admin().from("clinics").update({ trial_ends_at: new Date(Date.now() - 86_400_000).toISOString() }).eq("id", user.clinicId);
  await signIn(page, user);

  await expect(page.getByRole("alert").filter({ hasText: "Modo somente leitura." })).toBeVisible();

  await page.goto("/pacientes");
  await expect(page.getByText("Paciente Antigo")).toBeVisible();

  await page.goto("/pacientes/novo");
  await page.getByLabel("Nome completo").fill("Paciente Novo");
  await page.getByRole("button", { name: "Cadastrar paciente" }).click();
  await expect(page.getByText(/Assinatura inativa: a clínica está em modo somente leitura/)).toBeVisible();

  await page.goto("/configuracoes/assinatura");
  await expect(page.getByText("Somente leitura", { exact: true })).toBeVisible();
});

test("área do superadmin: 404 para quem não é; planos e clínicas para quem é", async ({ page }) => {
  await signIn(page, user);
  const denied = await page.goto("/admin");
  expect(denied?.status()).toBe(404);

  const userId = (await admin().rpc("find_user_id_by_email", { _email: user.email })).data!;
  await admin().from("platform_admins").insert({ user_id: userId });

  await page.goto("/admin/planos");
  await page.getByRole("button", { name: "Novo plano" }).click();
  const dialog = page.getByRole("dialog");
  planName = `Plano E2E ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await dialog.getByLabel("Nome").fill(planName);
  await dialog.getByLabel("Preço mensal (R$)").fill("149,90");
  await dialog.getByLabel("Máx. de unidades").fill("1");
  await dialog.getByRole("button", { name: "Criar plano" }).click();
  const row = page.getByRole("listitem").filter({ hasText: planName });
  await expect(row).toContainText(/149,90\/mês · 1 unidade ·/);

  await page.goto("/admin");
  await page.getByRole("link", { name: new RegExp(user.clinicName) }).click();
  await page.getByRole("button", { name: "Estender teste +14 dias" }).click();
  await expect(page.getByText("Atualizado.")).toBeVisible();

  // O plano aparece para a clínica assinar.
  await page.goto("/configuracoes/assinatura");
  await expect(page.getByText(planName)).toBeVisible();

});
