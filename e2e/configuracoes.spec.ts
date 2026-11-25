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

test("clínica nova já tem procedimentos sem preço", async ({ page }) => {
  await page.goto("/configuracoes");
  await page.getByRole("list", { name: "O que falta configurar" }).getByRole("link", { name: /procedimentos sem preço/ }).click();
  await expect(page).toHaveURL(/\/configuracoes\/procedimentos$/);

  await page.goto("/configuracoes/procedimentos");
  await expect(page.getByText("Profilaxia (limpeza)")).toBeVisible();
  await expect(page.getByText(/procedimentos estão sem preço/)).toBeVisible();
});

test("cria um procedimento e edita o preço", async ({ page }) => {
  await page.goto("/configuracoes/procedimentos");

  await page.getByRole("button", { name: "Novo procedimento" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome").fill("Manutenção de prótese");
  await dialog.getByLabel("Preço (R$)").fill("250,00");
  await dialog.getByLabel("Duração (minutos)").fill("40");
  await dialog.getByRole("button", { name: "Criar procedimento" }).click();
  await expect(dialog).toBeHidden();

  await page.getByLabel("Buscar procedimento").fill("manutencao de protese");
  const row = page.getByRole("listitem").filter({ hasText: "Manutenção de prótese" });
  await expect(row).toContainText("R$ 250,00");
  await expect(row).toContainText("40 min");

  await row.getByRole("button", { name: "Editar Manutenção de prótese" }).click();
  await page.getByRole("dialog").getByLabel("Preço (R$)").fill("1.234,56");
  await page.getByRole("dialog").getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(row).toContainText("R$ 1.234,56");
});

test("mostra erro de valor inválido sem fechar a janela", async ({ page }) => {
  await page.goto("/configuracoes/procedimentos");
  await page.getByRole("button", { name: "Novo procedimento" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome").fill("Teste");
  await dialog.getByLabel("Preço (R$)").fill("abc");
  await dialog.getByRole("button", { name: "Criar procedimento" }).click();
  await expect(dialog.getByText("Valor inválido. Ex.: 150,00")).toBeVisible();
});

test("cadastra profissional e salva horários", async ({ page }) => {
  await page.goto("/configuracoes/profissionais");
  await expect(page.getByText("Nenhum profissional cadastrado")).toBeVisible();

  await page.getByRole("button", { name: "Novo profissional" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome").fill("Dra. Beatriz");
  await dialog.getByLabel("CRO").fill("SP-54321");
  await dialog.getByRole("button", { name: "Criar e definir horários" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Dra. Beatriz" })).toBeVisible();
  await page.getByRole("button", { name: "Adicionar período na Segunda" }).click();
  await page.getByRole("button", { name: "Copiar segunda para terça a sexta" }).click();
  await page.getByRole("button", { name: "Salvar horários" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Horários salvos." })).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Sexta: início")).toHaveValue("08:00");
  await expect(page.getByRole("listitem").filter({ hasText: "Sábado" })).toContainText("Não atende");
});

test("cria cadeira", async ({ page }) => {
  await page.goto("/configuracoes/cadeiras");
  await page.getByRole("button", { name: "Nova cadeira" }).click();
  await page.getByRole("dialog").getByLabel("Nome").fill("Cadeira 1");
  await page.getByRole("dialog").getByRole("button", { name: "Criar cadeira" }).click();
  await expect(page.getByText("Cadeira 1")).toBeVisible();
});

test("menu das áreas leva às telas da área aberta", async ({ page }) => {
  await page.goto("/configuracoes/membros");
  // Computador: menu das áreas à esquerda; celular: abas da área. Em ambos, a tela vizinha está a um clique.
  await page.getByRole("link", { name: "Profissionais e horários", exact: true }).locator("visible=true").click();
  await expect(page).toHaveURL(/\/configuracoes\/profissionais$/);
  await expect(page.getByRole("link", { name: "Profissionais e horários", exact: true }).locator("visible=true")).toHaveAttribute("aria-current", "page");
});
