import { expect, test } from "@playwright/test";

import { createTestUser, hasSupabase, signIn, type TestUser } from "./support/test-user";

test.skip(!hasSupabase, "Precisa do Supabase configurado no .env.local");

let user: TestUser;

test.beforeEach(async ({ page }) => {
  user = await createTestUser();
  await signIn(page, user);
});

test.afterEach(async () => {
  await user.cleanup();
});

test("a raiz redireciona para o painel", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/painel$/);
  await expect(page.getByRole("heading", { level: 1, name: /Bom dia|Boa tarde|Boa noite|Painel/ })).toBeVisible();
});

test("navega pelo menu até Pacientes", async ({ page, isMobile }) => {
  if (isMobile) {
    await page.getByRole("button", { name: "Abrir menu" }).click();
  }

  const menu = page.getByRole("navigation", { name: "Menu principal" });
  await menu.getByRole("link", { name: "Pacientes" }).click();

  await expect(page).toHaveURL(/\/pacientes$/);
  await expect(page.getByRole("heading", { level: 1, name: "Pacientes" })).toBeVisible();
  await expect(page.getByText("Nenhum paciente por enquanto")).toBeVisible();
});

test("botões têm pelo menos 44px no toque", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Regra só para dispositivos de toque");
  const box = await page.getByRole("button", { name: "Abrir menu" }).boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
});

test("rota inexistente mostra a página 404", async ({ page }) => {
  await page.goto("/nao-existe");
  await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
});

test("busca global com Ctrl/⌘+K leva à página escolhida", async ({ page, isMobile }) => {
  test.skip(isMobile, "Atalho de teclado só no computador");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.keyboard.press("ControlOrMeta+k");
  const search = page.getByRole("combobox", { name: "Buscar paciente, página ou ação" });
  await expect(search).toBeFocused();
  await search.fill("finan");
  await expect(page.getByRole("option", { name: "Financeiro" })).toBeVisible();
  await search.press("Enter");
  await expect(page).toHaveURL(/\/financeiro$/);
});
