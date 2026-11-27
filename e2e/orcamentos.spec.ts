import { expect, test } from "@playwright/test";

import { admin, createTestUser, hasSupabase, seedClinical, signIn, type TestUser } from "./support/test-user";

test.skip(!hasSupabase, "Precisa do Supabase configurado no .env.local");

let user: TestUser;
let patientId: string;

test.beforeEach(async ({ page }) => {
  user = await createTestUser();
  ({ patientId } = await seedClinical(user));
  // Cárie no odontograma para a sugestão.
  await admin().from("tooth_records").insert({ clinic_id: user.clinicId, patient_id: patientId, tooth: 26, faces: ["O"], condition: "caries" });
  await signIn(page, user);
});

test.afterEach(async () => {
  await user.cleanup();
});

async function selectOption(page: import("@playwright/test").Page, label: string, option: string) {
  await page.getByLabel(label, { exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

test("monta, aprova em parte, gera parcelas, realiza e baixa o PDF", async ({ page }) => {
  await page.goto(`/pacientes/${patientId}/orcamentos`);
  await page.getByRole("link", { name: "Novo orçamento" }).click();

  // Sugestão do odontograma preenche dente e face.
  await page.getByRole("button", { name: /26 · Cárie \(O\)/ }).click();
  await selectOption(page, "Procedimento", "Restauração em resina - 1 face");
  await expect(page.getByLabel("Dente", { exact: true })).toContainText("26");
  await page.getByRole("button", { name: "Oclusal" }).click();
  await page.getByRole("button", { name: "Oclusal" }).click();
  await expect(page.getByRole("button", { name: "Oclusal" })).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Valor (R$)").fill("250,00");
  await page.getByRole("button", { name: "Incluir no orçamento" }).click();

  await selectOption(page, "Procedimento", "Profilaxia (limpeza)");
  await page.getByLabel("Valor (R$)").fill("150,00");
  await page.getByRole("button", { name: "Incluir no orçamento" }).click();
  await expect(page.getByText("R$ 400,00")).toBeVisible();

  await page.getByRole("button", { name: "Criar orçamento" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Orçamento" })).toBeVisible();
  await expect(page.getByText("Rascunho")).toBeVisible();
  await expect(page.getByText("Dente 26 · Oclusal")).toBeVisible();

  // PDF
  const pdf = await page.request.get(page.url() + "/pdf");
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");

  // Aprovação parcial em 2x
  await page.getByRole("button", { name: "Aprovar" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByText("Profilaxia (limpeza)").click();
  await selectOption(page, "Parcelas", "2x");
  await expect(dialog.getByText("R$ 250,00").first()).toBeVisible();
  await dialog.getByRole("button", { name: "Aprovar e gerar parcelas" }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByText("Aprovado em parte")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "1/2" })).toContainText("R$ 125,00");
  await expect(page.getByRole("listitem").filter({ hasText: "2/2" })).toContainText("R$ 125,00");

  // Realizar o item aprovado conclui o orçamento
  await page.getByRole("checkbox", { name: "Restauração em resina - 1 face: realizado" }).click();
  await expect(page.getByText("Concluído")).toBeVisible();
});

test("recusar orçamento", async ({ page }) => {
  await page.goto(`/orcamentos/novo?paciente=${patientId}`);
  await selectOption(page, "Procedimento", "Clareamento de consultório");
  await page.getByLabel("Valor (R$)").fill("800,00");
  await page.getByRole("button", { name: "Incluir no orçamento" }).click();
  await page.getByRole("button", { name: "Criar orçamento" }).click();
  await page.getByRole("button", { name: "Recusar" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Recusar" }).click();
  await expect(page.getByText("Recusado")).toBeVisible();
  await expect(page.getByRole("button", { name: "Aprovar" })).toHaveCount(0);

  await page.goto("/orcamentos?status=rejected");
  await expect(page.getByRole("link", { name: /Paciente Prontuário/ })).toBeVisible();
});

test("procedimento em sessões: 1 de 2, depois realizado", async ({ page }) => {
  await page.goto(`/orcamentos/novo?paciente=${patientId}`);
  await selectOption(page, "Procedimento", "Clareamento de consultório");
  await page.getByLabel("Valor (R$)").fill("800,00");
  await page.getByRole("button", { name: "Incluir no orçamento" }).click();
  await page.getByLabel("Sessões de Clareamento de consultório").fill("2");
  await page.getByRole("button", { name: "Criar orçamento" }).click();
  await page.getByRole("button", { name: "Aprovar" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Aprovar e gerar parcelas" }).click();
  await expect(page.getByText("0 de 2 sessões")).toBeVisible();

  await page.getByRole("button", { name: "Registrar sessão: Clareamento de consultório" }).click();
  await expect(page.getByText("1 de 2 sessões")).toBeVisible();
  await page.getByRole("button", { name: "Registrar sessão: Clareamento de consultório" }).click();
  await expect(page.getByText("2 de 2 sessões")).toBeVisible();
  await expect(page.getByText("Concluído")).toBeVisible();
});
