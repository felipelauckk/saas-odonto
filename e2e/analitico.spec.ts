import { expect, test } from "@playwright/test";

import { admin, createTestUser, hasSupabase, seedAgenda, signIn, type TestUser } from "./support/test-user";

test.skip(!hasSupabase, "Precisa do Supabase configurado no .env.local");

let user: TestUser;

test.beforeEach(async ({ page }) => {
  user = await createTestUser();
  const seed = await seedAgenda(user);
  // Um recebimento de R$ 500,00 hoje.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  await admin().from("receivables").insert({
    clinic_id: user.clinicId,
    unit_id: seed.unitId,
    patient_id: seed.patientId,
    professional_id: seed.professionalId,
    description: "Consulta",
    amount_cents: 50000,
    due_date: today,
    status: "paid",
    paid_at: new Date().toISOString(),
    paid_amount_cents: 50000,
  });
  await signIn(page, user);
});

test.afterEach(async () => {
  await user.cleanup();
});

test("define meta e o painel mostra realizado contra a meta", async ({ page }) => {
  await page.goto("/analitico/metas");
  await page.getByLabel("Faturamento (recebido) · Clínica (total)").fill("1.000,00");
  await page.getByLabel("Faturamento (recebido) · Dra. Ana").fill("2.000,00");
  await page.getByRole("button", { name: "Salvar metas" }).click();
  await expect(page.getByText("Metas salvas.")).toBeVisible();

  await page.goto("/analitico");
  await expect(page.getByRole("progressbar", { name: "Faturamento (recebido): 50% da meta" })).toBeVisible();
  await expect(page.getByText(/50% da meta de R\$\s?1\.000,00/)).toBeVisible();
  await expect(page.getByRole("cell", { name: /R\$\s?500,00 \(25%\)/ })).toBeVisible();
  await expect(page.getByText("Funil de captação (leads dos últimos 90 dias)")).toBeVisible();
});
