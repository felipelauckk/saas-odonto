import { expect, test } from "@playwright/test";

import { createTestUser, hasSupabase, seedClinical, signIn, type TestUser } from "./support/test-user";

test.skip(!hasSupabase, "Precisa do Supabase configurado no .env.local");

let user: TestUser;
let seed: Awaited<ReturnType<typeof seedClinical>>;

test.beforeEach(async ({ page }) => {
  user = await createTestUser();
  seed = await seedClinical(user);
  await signIn(page, user);
});

test.afterEach(async () => {
  await user.cleanup();
});

test("preenche ficha de implantodontia com tabela e periograma, e guarda versões", async ({ page }) => {
  test.slow();
  await page.goto(`/pacientes/${seed.patientId}/fichas`);
  await page.getByRole("link", { name: "Implantodontia" }).click();
  await expect(page.getByRole("heading", { name: "Implantodontia" })).toBeVisible();
  await page.getByRole("button", { name: "Preencher" }).click();
  await page.getByLabel("Planejamento").fill("Implante na região do 36");
  await page.getByRole("button", { name: "Sim" }).first().click();
  await page.getByLabel("Implantes: Dente, linha 1").fill("36");
  await page.getByLabel("Implantes: Marca, linha 1").fill("Neodent");
  await page.getByLabel("Implantes: Diâmetro (mm), linha 1").fill("4,1");
  await page.getByRole("button", { name: "Salvar nova versão" }).click();
  await expect(page.getByRole("cell", { name: "Neodent" })).toBeVisible();
  await expect(page.getByText("Implante na região do 36")).toBeVisible();

  await page.getByRole("button", { name: "Nova versão" }).click();
  await page.getByLabel("Planejamento").fill("Implantes no 36 e 46");
  await page.getByRole("button", { name: "Salvar nova versão" }).click();
  await expect(page.getByText("Implantes no 36 e 46")).toBeVisible();
  await expect(page.getByLabel("Versão").locator("option")).toHaveCount(2);

  await page.getByRole("link", { name: "Periodontia" }).click();
  await expect(page.getByRole("heading", { name: "Periodontia" })).toBeVisible();
  await page.getByRole("button", { name: "Preencher" }).click();
  await page.getByLabel("Dente 16, V: profundidade em mm").fill("5");
  await page.getByLabel("Dente 16, V: sangramento").check();
  await page.getByRole("button", { name: "Salvar nova versão" }).click();
  await expect(page.getByText("1 sítios avaliados · 1 com bolsa (≥ 4 mm) · sangramento em 100%")).toBeVisible();
});

test("constrói uma ficha nova em Configurações", async ({ page }) => {
  await page.goto("/configuracoes/fichas/nova");
  await page.getByLabel("Nome da ficha").fill("Estética dental");
  await page.getByRole("button", { name: "Adicionar campo" }).click();
  await page.getByLabel("Pergunta / campo").fill("Cor desejada");
  await page.getByRole("button", { name: "Salvar ficha" }).click();
  await expect(page.getByText("Ficha salva.")).toBeVisible();
  await page.goto("/configuracoes/fichas");
  await expect(page.getByRole("link", { name: /Estética dental/ })).toBeVisible();
});
