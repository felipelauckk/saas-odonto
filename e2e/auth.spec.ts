import { expect, test } from "@playwright/test";

import { createTestUser, hasSupabase, signIn, type TestUser } from "./support/test-user";

test.skip(!hasSupabase, "Precisa do Supabase configurado no .env.local");

test("sem login, o painel manda para a tela de entrar", async ({ page }) => {
  await page.goto("/painel");
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(page.getByRole("heading", { name: "Bem-vindo de volta" })).toBeVisible();
});

test("guarda a página pedida para depois do login", async ({ page }) => {
  await page.goto("/agenda");
  await expect(page).toHaveURL(/\/entrar\?next=%2Fagenda$/);
});

test("senha errada mostra mensagem de erro", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill("ninguem@example.com");
  await page.getByLabel("Senha").fill("senha-errada-1");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "E-mail ou senha incorretos." })).toBeVisible();
});

test("cadastro mostra os erros de validação", async ({ page }) => {
  await page.goto("/cadastro");
  await page.getByRole("button", { name: "Começar teste grátis de 14 dias" }).click();
  await expect(page.getByText("Informe o nome da clínica.")).toBeVisible();
  await expect(page.getByText("WhatsApp inválido. Use DDD + número.").or(page.getByText("Informe o WhatsApp."))).toBeVisible();
});

test.describe("com usuário", () => {
  let user: TestUser;

  test.beforeEach(async () => {
    user = await createTestUser();
  });

  test.afterEach(async () => {
    await user.cleanup();
  });

  test("entra, vê a clínica e sai", async ({ page, isMobile }) => {
    await signIn(page, user);
    await expect(page.getByRole("heading", { level: 1, name: /Bom dia|Boa tarde|Boa noite|Painel/ })).toBeVisible();

    if (isMobile) await page.getByRole("button", { name: "Abrir menu" }).click();
    await expect(page.getByText(user.clinicName).filter({ visible: true })).toBeVisible();

    await page.getByRole("button", { name: "Menu do usuário" }).filter({ visible: true }).click();
    await page.getByRole("menuitem", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/entrar$/);

    await page.goto("/painel");
    await expect(page).toHaveURL(/\/entrar$/);
  });

  test("owner abre a tela de equipe", async ({ page }) => {
    await signIn(page, user);
    await page.goto("/configuracoes/membros");
    await expect(page.getByRole("heading", { level: 1, name: "Equipe" })).toBeVisible();
    await expect(page.getByText("(você)")).toBeVisible();
  });
});
