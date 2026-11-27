import { expect, test } from "@playwright/test";

import { admin, createTestUser, hasSupabase, seedAgenda, signIn, sourceIds, type TestUser } from "./support/test-user";

test.skip(!hasSupabase, "Precisa do Supabase configurado no .env.local");

let user: TestUser;

test.beforeEach(async ({ page }) => {
  user = await createTestUser();
  await seedAgenda(user);
  await signIn(page, user);
});

test.afterEach(async () => {
  await user.cleanup();
});

const column = (page: import("@playwright/test").Page, name: string) => page.getByRole("region", { name: new RegExp(`^${name}, \\d+ leads$`) });

test("cria lead, move no funil e marca como perdido com motivo", async ({ page }) => {
  await page.goto("/crm");
  await page.getByRole("button", { name: "Novo lead" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome").fill("Carla Instagram");
  await dialog.getByLabel("Telefone").fill("11966665555");
  await dialog.getByRole("button", { name: "Criar lead" }).click();
  await expect(dialog).toBeHidden();
  await expect(column(page, "Novo contato").getByRole("button", { name: /Carla Instagram/ })).toBeVisible();

  await page.getByRole("button", { name: /Carla Instagram/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Em conversa" }).click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Em conversa" })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(column(page, "Em conversa").getByRole("button", { name: /Carla Instagram/ })).toBeVisible();

  await page.getByRole("button", { name: /Carla Instagram/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Perdido" }).click();
  const lost = page.getByRole("dialog", { name: "Motivo da perda" });
  await lost.getByRole("button", { name: "Achou caro" }).click();
  await lost.getByRole("button", { name: "Marcar como perdido" }).click();
  await expect(column(page, "Perdido").getByRole("button", { name: /Carla Instagram.*Achou caro/ })).toBeVisible();
});

test("agendar avaliação converte o lead em paciente e abre a agenda", async ({ page }) => {
  const { data: stage } = await admin().from("crm_stages").select("id").eq("clinic_id", user.clinicId).eq("auto_key", "new").single();
  const src = await sourceIds(user);
  await admin().from("leads").insert({ clinic_id: user.clinicId, name: "Davi Google", phone: "11944443333", source_id: src.google, stage_id: stage!.id });
  await page.goto("/crm");
  await page.getByRole("button", { name: /Davi Google/ }).click();
  await page.getByRole("button", { name: "Agendar avaliação" }).click();
  await expect(page).toHaveURL(/\/agenda\?paciente=/);
  await expect(page.getByRole("dialog").getByText("Davi Google")).toBeVisible();
  const { data: patient } = await admin().from("patients").select("source_id").eq("clinic_id", user.clinicId).eq("full_name", "Davi Google").single();
  expect(patient!.source_id).toBe(src.google);
});

test("formulário público cria lead no funil", async ({ page }) => {
  const { data: clinic } = await admin().from("clinics").select("lead_form_token").eq("id", user.clinicId).single();
  const response = await page.goto(`/captacao/${clinic!.lead_form_token}?origem=instagram`);
  // Pode ser incorporado no site da clínica; o resto do app não.
  expect(response!.headers()["x-frame-options"]).toBeUndefined();
  expect(response!.headers()["content-security-policy"]).toContain("frame-ancestors *");
  await page.getByLabel("Nome").fill("Elisa do Site");
  await page.getByLabel("WhatsApp ou telefone").fill("(11) 93333-2222");
  await page.getByLabel("O que você procura? (opcional)").fill("Clareamento");
  // O formulário ignora envios em menos de 3 segundos (robôs).
  await page.waitForTimeout(3200);
  await page.getByRole("button", { name: "Quero ser contatado" }).click();
  await expect(page.getByText("Recebemos seu contato!")).toBeVisible();

  const crm = await page.goto("/crm");
  expect(crm!.headers()["x-frame-options"]).toBe("DENY");
  await expect(column(page, "Novo contato").getByRole("button", { name: /Elisa do Site.*Instagram.*Clareamento/ })).toBeVisible();
});

test("configura etapa e campanha", async ({ page }) => {
  await page.goto("/configuracoes/crm");
  await page.getByLabel("Nova etapa").fill("Retornar depois");
  await page.getByRole("button", { name: "Adicionar etapa" }).click();
  await expect(page.getByLabel("Nome da etapa Retornar depois")).toBeVisible();

  await page.getByRole("button", { name: "Nova campanha" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome").fill("Instagram novembro");
  await dialog.getByLabel("Valor investido (R$)").fill("500,00");
  await dialog.getByRole("button", { name: "Criar" }).click();
  await expect(page.getByText(/Instagram novembro.*R\$\s?500,00/)).toBeVisible();
  await expect(page.getByLabel("Link do formulário")).toHaveValue(/\/captacao\/[0-9a-f]{32}$/);
});
