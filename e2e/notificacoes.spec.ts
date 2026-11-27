import { expect, test } from "@playwright/test";

import { admin, createTestUser, hasSupabase, seedAgenda, signIn, type TestUser } from "./support/test-user";

test.skip(!hasSupabase, "Precisa do Supabase configurado no .env.local");

let user: TestUser;

test.beforeEach(async ({ page }) => {
  user = await createTestUser();
  await signIn(page, user);
});

test.afterEach(async () => {
  await user.cleanup();
});

test("sino recebe o agendamento online em tempo real e marca como lida", async ({ page, isMobile }) => {
  const seed = await seedAgenda(user);
  await page.goto("/painel");
  const bell = page.getByRole("button", { name: /^Notificações/ }).filter({ visible: true });
  await expect(bell).toHaveAccessibleName("Notificações");
  // Espera o canal de tempo real conectar.
  await expect(bell).toHaveAttribute("data-live", "true", { timeout: 15_000 });

  await admin().from("appointments").insert({
    clinic_id: user.clinicId,
    unit_id: seed.unitId,
    patient_id: seed.patientId,
    professional_id: seed.professionalId,
    starts_at: "2030-03-04T10:00:00-03:00",
    ends_at: "2030-03-04T10:30:00-03:00",
    booked_online: true,
  });
  await expect(bell).toHaveAccessibleName("Notificações: 1 não lidas", { timeout: 20_000 });
  await bell.click();
  const panel = page.getByRole("dialog", { name: "Notificações" });
  await expect(panel.getByText(/Agendamento online:/)).toBeVisible();
  await panel.getByRole("button", { name: "Marcar todas como lidas" }).click();
  await expect(panel.getByText("Tudo lido.")).toBeVisible();
  void isMobile;
});

test("busca acha configuração por sinônimo; Ajuda e Novidades abrem e o ponto some", async ({ page, isMobile }) => {
  await page.goto("/painel");
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox").fill("mensagem de confirmacao");
  await expect(page.getByRole("option", { name: /Mensagens automáticas/ })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto("/ajuda");
  await expect(page.getByRole("heading", { name: "Ajuda", level: 1 })).toBeVisible();
  await expect(page.getByText("Como marco uma consulta?")).toBeVisible();

  if (!isMobile) await expect(page.getByRole("link", { name: /Novidades \(há novidade\)/ })).toBeVisible();
  await page.goto("/novidades");
  await expect(page.getByRole("heading", { name: "Agenda, ficha e financeiro mais completos" })).toBeVisible();
  await page.waitForTimeout(1500);
  await page.goto("/painel");
  if (!isMobile) await expect(page.getByRole("link", { name: "Novidades", exact: true })).toBeVisible();
});

test("avaliações no Google: link nos dados da clínica, pedido pela ficha e relatório", async ({ page }) => {
  const seed = await seedAgenda(user);
  await page.goto("/configuracoes/clinica");
  await page.getByLabel("Link de avaliação no Google").fill("https://g.page/r/clinica-e2e/review");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Dados da clínica salvos.")).toBeVisible();

  await page.goto(`/pacientes/${seed.patientId}`);
  await page.getByRole("button", { name: "Mais" }).click();
  await page.getByRole("menuitem", { name: "Pedir avaliação no Google" }).click();
  await expect(page.getByRole("dialog").getByLabel("Pedir avaliação no Google")).toHaveValue("https://g.page/r/clinica-e2e/review");
  await page.keyboard.press("Escape");

  await page.goto("/relatorios/avaliacoes-google");
  await expect(page.getByRole("heading", { name: "Avaliações no Google" })).toBeVisible();
  await expect(page.getByText(/Google Business Profile/)).toBeVisible();
});
