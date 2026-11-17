import { expect, test } from "@playwright/test";

import { admin, createTestUser, hasSupabase, seedAgenda, signIn, type TestUser } from "./support/test-user";

test.skip(!hasSupabase, "Precisa do Supabase configurado no .env.local");

let user: TestUser;
let seed: Awaited<ReturnType<typeof seedAgenda>>;

test.beforeEach(async ({ page }) => {
  user = await createTestUser();
  seed = await seedAgenda(user);
  // Expediente também no fim de semana, para sempre haver horário amanhã.
  await admin().from("professional_schedules").insert([0, 6].map((weekday) => ({ clinic_id: user.clinicId, unit_id: seed.unitId, professional_id: seed.professionalId, weekday, start_time: "08:00", end_time: "18:00" })));
  await signIn(page, user);
});

test.afterEach(async () => {
  await user.cleanup();
});

test("liga o agendamento online, paciente marca com código e a consulta aparece", async ({ page }) => {
  test.slow();
  await page.goto("/configuracoes/agendamento-online");
  await page.getByText("Agendamento online desligado").click();
  await page.getByLabel("Antecedência mínima (horas)").fill("0");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Configuração salva.")).toBeVisible();
  const url = await page.getByLabel("Link de agendamento").inputValue();
  await expect(page.getByRole("img", { name: /QR Code de check-in/ })).toBeVisible();

  await page.goto(url);
  await page.getByRole("button", { name: "Próxima semana" }).click();
  await page.getByRole("button", { name: /^10:00/ }).first().click();
  await page.getByRole("button", { name: /^Continuar · .* às 10:00$/ }).click();
  await page.getByLabel("Nome completo").fill("Roberta Site");
  await page.getByLabel("WhatsApp").fill("(11) 94444-3333");
  await page.getByRole("button", { name: "Receber código" }).click();
  const code = (await page.getByRole("note").textContent())!.match(/\d{6}/)![0];
  await page.getByLabel("Código").fill(code);
  await page.getByRole("button", { name: "Confirmar agendamento" }).click();
  await expect(page.getByRole("heading", { name: "Consulta marcada!" })).toBeVisible();

  const { data } = await admin().from("appointments").select("booked_online").eq("clinic_id", user.clinicId).eq("booked_online", true);
  expect(data).toHaveLength(1);
});

test("envia o portal ao paciente e ele pede remarcação", async ({ page }) => {
  const start = new Date(Date.now() + 2 * 86_400_000);
  await admin().from("appointments").insert({ clinic_id: user.clinicId, unit_id: seed.unitId, patient_id: seed.patientId, professional_id: seed.professionalId, starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 1_800_000).toISOString() });
  await page.goto(`/pacientes/${seed.patientId}`);
  await page.getByRole("button", { name: "Portal do paciente" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("link", { name: "Enviar pelo WhatsApp" })).toHaveAttribute("href", /wa\.me\/5511988887777/);
  const url = await dialog.getByLabel("Link do portal").inputValue();

  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Olá, Paciente!" })).toBeVisible();
  await page.getByRole("button", { name: "Confirmar presença" }).click();
  await expect(page.getByText("Presença confirmada.")).toBeVisible();
  await page.getByRole("button", { name: "Pedir remarcação" }).click();
  await expect(page.getByText("Remarcação pedida: a clínica vai entrar em contato")).toBeVisible();
});
