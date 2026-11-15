import { expect, test } from "@playwright/test";

import { admin, createTestUser, hasSupabase, seedAgenda, signIn, type TestUser } from "./support/test-user";

test.skip(!hasSupabase, "Precisa do Supabase configurado no .env.local");

let user: TestUser;
let seed: Awaited<ReturnType<typeof seedAgenda>>;

const isoDay = (offset: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(Date.now() + offset * 86_400_000));

test.beforeEach(async ({ page }) => {
  user = await createTestUser();
  seed = await seedAgenda(user);
  await signIn(page, user);
});

test.afterEach(async () => {
  await user.cleanup();
});

test("cadastra laboratório com serviço, cria ordem e move para o laboratório", async ({ page }) => {
  test.slow();
  await page.goto("/configuracoes/laboratorios");
  await page.getByRole("button", { name: "Novo laboratório" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome").fill("Lab Sorriso");
  await dialog.getByRole("button", { name: "Criar" }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "Adicionar serviço" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Serviço").fill("Coroa de zircônia");
  await dialog.getByLabel("Preço (R$)").fill("350,00");
  await dialog.getByLabel("Prazo (dias)").fill("7");
  await dialog.getByRole("button", { name: "Adicionar" }).click();
  await expect(page.getByText("Coroa de zircônia")).toBeVisible();

  await page.goto("/proteses");
  await page.getByRole("button", { name: "Nova ordem" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Paciente").fill("Paciente Ag");
  await dialog.getByRole("button", { name: /Paciente Agenda/ }).click();
  await dialog.getByLabel("Laboratório", { exact: true }).selectOption({ label: "Lab Sorriso" });
  await dialog.getByLabel("Serviço (tabela do laboratório)").selectOption({ label: "Coroa de zircônia" });
  await expect(dialog.getByLabel("Custo (R$)")).toHaveValue("350,00");
  await expect(dialog.getByLabel("Retorno previsto")).toHaveValue(isoDay(7));
  await dialog.getByLabel("Dentes").fill("11");
  await dialog.getByRole("button", { name: "Criar ordem" }).click();
  await expect(dialog).toBeHidden();

  const moldagem = page.getByRole("region", { name: /^Moldagem, 1 ordens$/ });
  await moldagem.getByRole("button", { name: /Paciente Agenda/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "No laboratório" }).click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "No laboratório" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("dialog").getByRole("button", { name: "Lançar em contas a pagar" }).click();
  await expect(page.getByRole("dialog").getByText("lançado em contas a pagar")).toBeVisible();
});

test("agenda avisa quando o trabalho ainda está no laboratório", async ({ page }) => {
  await admin().from("prosthetic_orders").insert({ clinic_id: user.clinicId, unit_id: seed.unitId, patient_id: seed.patientId, work_type: "Ponte fixa", stage: "sent", expected_return_on: "2030-03-10" });
  await page.goto("/agenda?data=2030-03-04");
  await page.getByRole("button", { name: "Marcar consulta Dra. Ana às 09:00" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Paciente").fill("Paciente Ag");
  await dialog.getByRole("button", { name: /Paciente Agenda/ }).click();
  await expect(dialog.getByRole("status")).toContainText("Ponte fixa só volta do laboratório em 10/03/2030");
});
