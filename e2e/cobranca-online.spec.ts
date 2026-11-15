import { expect, test } from "@playwright/test";

import { admin, createTestUser, hasSupabase, seedAgenda, signIn, type TestUser } from "./support/test-user";

test.skip(!hasSupabase, "Precisa do Supabase configurado no .env.local");

let user: TestUser;
let seed: Awaited<ReturnType<typeof seedAgenda>>;
let receivableId = "";

test.beforeEach(async ({ page }) => {
  user = await createTestUser();
  seed = await seedAgenda(user);
  const due = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(Date.now() + 10 * 86_400_000));
  const { data } = await admin()
    .from("receivables")
    .insert({ clinic_id: user.clinicId, unit_id: seed.unitId, patient_id: seed.patientId, description: "Clareamento 1/1", amount_cents: 80000, due_date: due })
    .select("id")
    .single();
  receivableId = data!.id;
  await signIn(page, user);
});

test.afterEach(async () => {
  await user.cleanup();
});

test("configuração mostra a régua padrão e o formulário de conexão", async ({ page }) => {
  await page.goto("/configuracoes/cobranca");
  await expect(page.getByLabel("Chave de API")).toBeVisible();
  await expect(page.getByText("3 dias antes do vencimento")).toBeVisible();
  await expect(page.getByText("15 dias de atraso")).toBeVisible();
  await page.getByLabel("Mensagem: No dia do vencimento").fill("Olá, {{paciente}}! Vence hoje: {{valor}}. {{link}}");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Etapa salva.")).toBeVisible();
});

test("parcela em negociação e cobrança já enviada", async ({ page }) => {
  await admin().from("clinic_billing").insert({ clinic_id: user.clinicId, environment: "sandbox", api_key_encrypted: "v1.x.y.z", api_key_hint: "1234", connected_at: new Date().toISOString() });
  await page.goto("/financeiro");
  await expect(page.getByRole("button", { name: "Cobrar online" })).toBeVisible();

  await page.getByRole("button", { name: /Mais ações: Clareamento/ }).click();
  await page.getByRole("menuitem", { name: "Marcar em negociação" }).click();
  await expect(page.getByText("Em negociação")).toBeVisible();

  await admin().from("patient_charges").insert({
    clinic_id: user.clinicId,
    patient_id: seed.patientId,
    receivable_ids: [receivableId],
    kind: "link",
    amount_cents: 80000,
    due_date: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(Date.now() + 10 * 86_400_000)),
    invoice_url: "https://sandbox.asaas.com/i/teste",
  });
  await page.reload();
  await page.getByRole("button", { name: "Ver cobrança" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("link", { name: "Enviar pelo WhatsApp" })).toHaveAttribute("href", /wa\.me\/5511988887777\?text=.*sandbox\.asaas\.com%2Fi%2Fteste/);
});
