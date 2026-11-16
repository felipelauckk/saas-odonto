import { expect, test } from "@playwright/test";

import { admin, createTestUser, hasSupabase, seedAgenda, signIn, type TestUser } from "./support/test-user";

test.skip(!hasSupabase, "Precisa do Supabase configurado no .env.local");

let user: TestUser;

test.beforeEach(async () => {
  user = await createTestUser();
});

test.afterEach(async () => {
  await user.cleanup();
});

function todaySp() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

test("painel mostra indicadores e a agenda de hoje; auditoria registra a abertura; exporta dados", async ({ page }) => {
  const seed = await seedAgenda(user);
  const today = todaySp();
  await admin().from("appointments").insert({
    clinic_id: user.clinicId,
    unit_id: seed.unitId,
    patient_id: seed.patientId,
    professional_id: seed.professionalId,
    starts_at: `${today}T00:05:00-03:00`,
    ends_at: `${today}T00:35:00-03:00`,
    status: "done",
  });
  await admin().from("receivables").insert({
    clinic_id: user.clinicId,
    unit_id: seed.unitId,
    patient_id: seed.patientId,
    description: "Consulta",
    amount_cents: 25000,
    due_date: "2099-01-01",
  });

  await signIn(page, user);
  await expect(page.getByRole("heading", { level: 1, name: /^(Bom dia|Boa tarde|Boa noite), Pessoa$/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Consultas hoje\s*1/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /A receber.*R\$\s250\b/i })).toBeVisible();
  await expect(page.getByRole("region", { name: "Resumo do dia" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Faturamento de" })).toContainText("Projeção do mês");
  await expect(page.getByRole("link", { name: "Paciente Agenda" })).toBeVisible();

  // Abrir o prontuário fica na auditoria.
  await page.goto(`/pacientes/${seed.patientId}/evolucoes`);
  await page.goto("/configuracoes/auditoria");
  await expect(page.getByText(/Pessoa Teste abriu evolução de/)).toBeVisible();

  // Exportação LGPD
  const response = await page.request.get(`/pacientes/${seed.patientId}/exportar`);
  expect(response.headers()["content-type"]).toBe("application/pdf");
  expect((await response.body()).subarray(0, 4).toString()).toBe("%PDF");
  await page.goto("/configuracoes/auditoria?acao=export");
  await expect(page.getByText(/exportou dados do paciente de Paciente Agenda/)).toBeVisible();
});
