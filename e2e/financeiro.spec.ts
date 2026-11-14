import { expect, test } from "@playwright/test";

import { createTestUser, hasSupabase, seedClinical, signIn, type TestUser } from "./support/test-user";

test.skip(!hasSupabase, "Precisa do Supabase configurado no .env.local");

let user: TestUser;
let patientId: string;

test.beforeEach(async ({ page }) => {
  user = await createTestUser();
  ({ patientId } = await seedClinical(user));
  await signIn(page, user);
});

test.afterEach(async () => {
  await user.cleanup();
});

test("cobra, recebe com taxa, entra no caixa, gera recibo e estorna", async ({ page }) => {
  await page.goto(`/pacientes/${patientId}/financeiro`);
  await page.getByRole("button", { name: "Nova cobrança" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Descrição").fill("Consulta de urgência");
  await dialog.getByLabel("Valor (R$)").fill("200,00");
  await dialog.getByRole("button", { name: "Criar cobrança" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Consulta de urgência")).toBeVisible();

  await page.getByRole("button", { name: "Receber" }).click();
  await page.getByLabel("Forma de pagamento").click();
  await page.getByRole("option", { name: "Pix", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar recebimento" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText("Pago", { exact: true })).toBeVisible();

  const receiptLink = page.getByRole("link", { name: "Recibo" });
  const receipt = await page.request.get(await receiptLink.getAttribute("href") as string);
  expect(receipt.headers()["content-type"]).toBe("application/pdf");

  await page.goto("/financeiro/caixa");
  await expect(page.getByText(/Recebimento: Paciente Prontuário — Consulta de urgência/)).toBeVisible();
  await expect(page.getByRole("definition").filter({ hasText: "R$ 200,00" }).first()).toBeVisible();

  await page.getByRole("button", { name: "Lançar no caixa" }).click();
  await page.getByRole("dialog").getByLabel("Descrição").fill("Compra de luvas");
  await page.getByRole("dialog").getByLabel("Valor (R$)").fill("50,00");
  await page.getByRole("dialog").getByRole("button", { name: "Lançar" }).click();
  await expect(page.getByText("Compra de luvas")).toBeVisible();
  await expect(page.getByText("R$ 150,00")).toBeVisible();

  await page.goto("/financeiro?status=pagos");
  await page.getByRole("button", { name: /Mais ações: Consulta de urgência/ }).click();
  await page.getByRole("menuitem", { name: "Estornar pagamento" }).click();
  await page.goto("/financeiro");
  await expect(page.getByText("Consulta de urgência")).toBeVisible();
  await expect(page.getByRole("button", { name: "Receber" })).toBeVisible();
});
