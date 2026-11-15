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

test("configura a IA e a caixa de entrada recebe a mensagem simulada", async ({ page }) => {
  await page.goto("/configuracoes/inteligencia-artificial");
  await expect(page.getByText("Uso neste mês")).toBeVisible();
  await page.getByLabel("Informações para o assistente").fill("Rua das Flores, 100. Atendemos de segunda a sexta, das 8h às 18h.");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Configuração salva.")).toBeVisible();

  // Assistente desligado: a mensagem chega para a equipe.
  await page.goto("/whatsapp");
  await page.getByText("Testar o assistente").click();
  await page.getByLabel("Telefone do paciente (teste)").fill("(11) 97777-6666");
  await page.getByLabel("Mensagem do paciente (teste)").fill("Oi, vocês abrem sábado?");
  await page.getByRole("button", { name: "Simular" }).click();
  await expect(page.getByText(/Mensagem recebida/)).toBeVisible();
  await expect(page.getByText("Oi, vocês abrem sábado?")).toBeVisible();
  await page.getByLabel("Responder").fill("Olá! Aos sábados não abrimos.");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText("Olá! Aos sábados não abrimos.")).toBeVisible();
  await expect(page.getByText("Com a equipe").first()).toBeVisible();
});

test("configura a nota fiscal e a aba de notas aparece no financeiro", async ({ page }) => {
  await page.goto("/configuracoes/nota-fiscal");
  await page.getByLabel("Código do serviço na prefeitura").fill("04.12");
  await page.getByLabel("Alíquota de ISS (%)").fill("2");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText(/Configuração salva/)).toBeVisible();
  await page.goto("/financeiro/notas");
  await expect(page.getByText("Nenhuma nota no período")).toBeVisible();
});
