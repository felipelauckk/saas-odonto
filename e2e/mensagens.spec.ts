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

test("edita o texto do lembrete com prévia e envia lembrete pela agenda", async ({ page }) => {
  const seed = await seedAgenda(user);
  await admin().from("appointments").insert({
    clinic_id: user.clinicId,
    unit_id: seed.unitId,
    patient_id: seed.patientId,
    professional_id: seed.professionalId,
    starts_at: "2030-03-04T09:00:00-03:00",
    ends_at: "2030-03-04T09:30:00-03:00",
  });

  await page.goto("/configuracoes/mensagens");
  await expect(page.getByText("Envio simulado.")).toBeVisible();
  const reminder = page.getByRole("region", { name: "Lembrete de consulta" });
  await reminder.getByRole("textbox").fill("Oi {{paciente}}, até {{data}} às {{hora}}!");
  await expect(reminder.getByText("Prévia: Oi Ana, até segunda-feira, 16 de novembro às 09:30!")).toBeVisible();
  await reminder.getByRole("button", { name: "Salvar" }).click();
  await expect(reminder.getByText("Mensagem salva.")).toBeVisible();

  await page.goto("/agenda?data=2030-03-04");
  await page.getByRole("button", { name: /Paciente Agenda, 09:00/ }).click();
  await page.getByRole("button", { name: "Enviar lembrete" }).click();
  await expect(page.getByText(/Lembrete registrado \(envio simulado/)).toBeVisible();

  await page.goto("/configuracoes/mensagens");
  await expect(page.getByText("Oi Paciente, até segunda-feira, 4 de março às 09:00!")).toBeVisible();
});
