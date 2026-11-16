import { expect, test } from "@playwright/test";

import { admin, createTestUser, hasSupabase, seedAgenda, signIn, type TestUser } from "./support/test-user";

test.skip(!hasSupabase, "Precisa do Supabase configurado no .env.local");

// Segunda-feira no futuro: não depende do dia em que o teste roda.
const DAY = "2030-03-04";
const at = (time: string) => `${DAY}T${time}:00-03:00`;

let user: TestUser;
let seed: Awaited<ReturnType<typeof seedAgenda>>;

test.beforeEach(async ({ page }) => {
  user = await createTestUser();
  seed = await seedAgenda(user);
  await signIn(page, user);
});

test.afterEach(async () => {
  await user.cleanup();
});

async function insertAppointment(start: string, end: string) {
  const { error } = await admin().from("appointments").insert({
    clinic_id: user.clinicId,
    unit_id: seed.unitId,
    patient_id: seed.patientId,
    professional_id: seed.professionalId,
    starts_at: at(start),
    ends_at: at(end),
  });
  if (error) throw error;
}

test("marca consulta clicando num horário livre", async ({ page }) => {
  await page.goto(`/agenda?data=${DAY}`);
  await expect(page.getByText("segunda-feira, 4 de março")).toBeVisible();

  await page.getByRole("button", { name: "Marcar consulta Dra. Ana às 09:00" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Paciente").fill("Paciente Ag");
  await dialog.getByRole("button", { name: /Paciente Agenda/ }).click();
  await expect(dialog.getByLabel("Início")).toHaveValue("09:00");
  await dialog.getByRole("button", { name: "Marcar consulta" }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByRole("button", { name: "Paciente Agenda, 09:00 a 09:30, Agendado" })).toBeVisible();
});

test("impede dois pacientes no mesmo horário do profissional", async ({ page }) => {
  await insertAppointment("10:00", "11:00");
  await page.goto(`/agenda?data=${DAY}`);

  await page.getByRole("button", { name: "Nova consulta" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Data").fill(DAY);
  await dialog.getByLabel("Início").fill("10:30");
  await dialog.getByLabel("Paciente").fill("Novo Paciente Conflito");
  await dialog.getByRole("button", { name: 'Cadastrar "Novo Paciente Conflito"' }).click();
  await dialog.getByRole("button", { name: "Cadastrar e selecionar" }).click();
  await expect(dialog.getByText("Novo Paciente Conflito")).toBeVisible();
  await dialog.getByRole("button", { name: "Marcar consulta" }).click();

  await expect(dialog.getByText("O profissional já tem consulta nesse horário.")).toBeVisible();
});

test("muda status com um clique e a falta aparece no relatório", async ({ page }) => {
  await insertAppointment("14:00", "14:30");
  await page.goto(`/agenda?data=${DAY}`);

  await page.getByRole("button", { name: /Paciente Agenda, 14:00/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Confirmado" }).click();
  await expect(dialog.getByRole("button", { name: "Confirmado" })).toHaveAttribute("aria-pressed", "true");
  await dialog.getByRole("button", { name: "Faltou" }).click();
  await expect(dialog.getByRole("button", { name: "Faltou" })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");

  await page.goto("/agenda/faltas?de=2030-03-01&ate=2030-03-10");
  await expect(page.getByRole("link", { name: "Paciente Agenda" })).toBeVisible();
  await expect(page.getByText("segunda-feira, 4 de março às 14:00", { exact: false })).toBeVisible();
});

test("bloqueio impede marcar no horário", async ({ page }) => {
  await page.goto(`/agenda?data=${DAY}`);
  await page.getByRole("button", { name: "Bloquear" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Motivo (opcional)").fill("Almoço");
  await dialog.getByRole("button", { name: "Bloquear horário" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: /Almoço · 12:00–13:00/ })).toBeVisible();

  await page.getByRole("button", { name: "Nova consulta" }).click();
  await dialog.getByLabel("Paciente").fill("Paciente Ag");
  await dialog.getByRole("button", { name: /Paciente Agenda/ }).click();
  await dialog.getByLabel("Início").fill("12:15");
  await dialog.getByRole("button", { name: "Marcar consulta" }).click();
  await expect(dialog.getByText("Horário bloqueado: Almoço")).toBeVisible();
});

test("arrasta a consulta para remarcar", async ({ page, isMobile }) => {
  test.skip(isMobile, "No toque, remarcar é pelo botão Editar ou remarcar");
  await insertAppointment("09:00", "09:30");
  await page.goto(`/agenda?data=${DAY}`);

  const card = page.getByRole("button", { name: /Paciente Agenda, 09:00/ });
  const target = page.getByRole("button", { name: "Marcar consulta Dra. Ana às 11:00" });
  const from = (await card.boundingBox())!;
  const to = (await target.boundingBox())!;

  await page.mouse.move(from.x + from.width / 2, from.y + 5);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + 10, { steps: 12 });
  await page.mouse.up();

  await expect(page.getByRole("button", { name: /Paciente Agenda, 11:00 a 11:30/ })).toBeVisible();
  const { data } = await admin().from("appointments").select("starts_at").eq("patient_id", seed.patientId).single();
  expect(new Date(data!.starts_at).toISOString()).toBe(new Date(at("11:00")).toISOString());
});

test("remarca pela janela de edição", async ({ page }) => {
  await insertAppointment("09:00", "09:30");
  await page.goto(`/agenda?data=${DAY}`);
  await page.getByRole("button", { name: /Paciente Agenda, 09:00/ }).click();
  await page.getByRole("button", { name: "Editar ou remarcar" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Início").fill("15:30");
  await dialog.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: /Paciente Agenda, 15:30 a 16:00/ })).toBeVisible();
});

test("atualiza sozinha quando outra pessoa marca (tempo real)", async ({ page }) => {
  await page.goto(`/agenda?data=${DAY}`);
  await expect(page.getByRole("button", { name: "Marcar consulta Dra. Ana às 16:00" })).toBeAttached();
  // Espera o canal de tempo real conectar.
  await expect(page.getByText("Ao vivo")).toBeVisible({ timeout: 15_000 });

  await insertAppointment("16:00", "16:45");
  await expect(page.getByRole("button", { name: /Paciente Agenda, 16:00 a 16:45/ })).toBeVisible({ timeout: 15_000 });
});

test("visão semanal mostra os 7 dias", async ({ page }) => {
  await insertAppointment("09:00", "09:30");
  await page.goto(`/agenda?data=${DAY}&visao=semana`);
  await expect(page.getByRole("heading", { level: 1, name: "4 a 10 de março" })).toBeVisible();
  await expect(page.getByText("dom., 10", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Paciente Agenda, 09:00/ })).toBeVisible();
});

test("a ficha do paciente lista as consultas", async ({ page }) => {
  await insertAppointment("09:00", "09:30");
  await page.goto(`/pacientes/${seed.patientId}/agendamentos`);
  await expect(page.getByText("Próximas")).toBeVisible();
  await expect(page.getByText(/segunda-feira, 4 de março · 09:00–09:30/)).toBeVisible();
});
