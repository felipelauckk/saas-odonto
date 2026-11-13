import { expect, test } from "@playwright/test";

test("a raiz redireciona para o painel", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/painel$/);
  await expect(page.getByRole("heading", { level: 1, name: "Painel" })).toBeVisible();
});

test("navega pelo menu até Pacientes", async ({ page, isMobile }) => {
  await page.goto("/painel");

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
  await page.goto("/painel");
  const box = await page.getByRole("button", { name: "Abrir menu" }).boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
});

test("rota inexistente mostra a página 404", async ({ page }) => {
  await page.goto("/nao-existe");
  await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
});
