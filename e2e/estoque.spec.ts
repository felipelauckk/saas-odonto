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

test("cadastra produto, dá entrada e saída, e avisa abaixo do mínimo", async ({ page }) => {
  await page.goto("/estoque");
  await page.getByRole("button", { name: "Produto" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome").fill("Luva de procedimento");
  await dialog.getByLabel("Unidade de medida").fill("cx");
  await dialog.getByLabel("Estoque mínimo").fill("3");
  await dialog.getByRole("button", { name: "Criar" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("button", { name: "Entrada" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Produto").selectOption({ label: "Luva de procedimento (cx)" });
  await dialog.getByLabel("Quantidade").fill("5");
  await dialog.getByLabel("Custo unitário (R$)").fill("30,00");
  await dialog.getByRole("button", { name: "Registrar entrada" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("5 cx")).toBeVisible();

  await page.getByRole("button", { name: "Saída" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Produto").selectOption({ label: "Luva de procedimento (cx)" });
  await dialog.getByLabel("Quantidade").fill("3");
  await dialog.getByRole("button", { name: "Registrar saída" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Abaixo do mínimo")).toBeVisible();

  await page.getByRole("link", { name: /Lista de compras/ }).click();
  await expect(page.getByText("Comprar 4 cx")).toBeVisible();
});
