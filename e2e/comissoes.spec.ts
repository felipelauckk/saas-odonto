import { expect, test } from "@playwright/test";

import { admin, createTestUser, hasSupabase, seedClinical, signIn, type TestUser } from "./support/test-user";

test.skip(!hasSupabase, "Precisa do Supabase configurado no .env.local");

let user: TestUser;

test.afterEach(async () => {
  await user.cleanup();
});

function lastMonth() {
  const now = new Date(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()) + "T12:00:00Z");
  now.setUTCDate(1);
  now.setUTCMonth(now.getUTCMonth() - 1);
  return now.toISOString().slice(0, 7);
}

test("percentual padrão, extrato do mês anterior e fechamento com repasse", async ({ page }) => {
  user = await createTestUser();
  const { patientId } = await seedClinical(user);
  const a = admin();
  const month = lastMonth();
  const { data: pro } = await a.from("professionals").select("id").eq("clinic_id", user.clinicId).single();
  const { data: unit } = await a.from("units").select("id").eq("clinic_id", user.clinicId).single();
  // Pagamento de R$ 1.000,00 recebido no mês passado (sem orçamento).
  await a.from("receivables").insert({
    clinic_id: user.clinicId, unit_id: unit!.id, patient_id: patientId, professional_id: pro!.id,
    description: "Consulta", amount_cents: 100000, due_date: `${month}-10`,
    status: "paid", paid_at: `${month}-10T12:00:00-03:00`, paid_amount_cents: 100000, fee_cents: 2000,
  });
  await signIn(page, user);

  await page.goto("/configuracoes/comissoes");
  const card = page.getByRole("region", { name: "Comissão de Dr. Dono" });
  await card.getByLabel("Percentual padrão").fill("30");
  await card.getByRole("button", { name: "Salvar %" }).click();
  await expect(card.getByText("Percentual salvo.")).toBeVisible();

  await page.goto(`/financeiro/comissoes?mes=${month}`);
  // (100.000 − taxa 2.000) × 30% = 29.400
  await expect(page.getByText("R$ 294,00").first()).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Fechar mês" }).click();
  await expect(page.getByText("Mês fechado e repasse lançado em contas a pagar.")).toBeVisible();
  await page.reload();
  await expect(page.getByText(/fechado em/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Demonstrativo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Fechar mês" })).toHaveCount(0);

  const { data: payable } = await a.from("payables").select("amount_cents, description").eq("clinic_id", user.clinicId).single();
  expect(payable).toMatchObject({ amount_cents: 29400 });
  expect(payable!.description).toContain("Comissão Dr. Dono");
});
