import { expect, test } from "@playwright/test";

import { admin, createTestUser, hasSupabase, seedAgenda, signIn, type TestUser } from "./support/test-user";

test.skip(!hasSupabase, "Precisa do Supabase configurado no .env.local");

const DAY = "2030-03-04"; // segunda-feira
const at = (day: string, time: string) => `${day}T${time}:00-03:00`;

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

async function insertAppointment(day: string, start: string, end: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await admin()
    .from("appointments")
    .insert({ clinic_id: user.clinicId, unit_id: seed.unitId, patient_id: seed.patientId, professional_id: seed.professionalId, starts_at: at(day, start), ends_at: at(day, end), ...extra })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

test("consultas em série avisam a data que conflita e marcam as outras", async ({ page }) => {
  await insertAppointment("2030-03-11", "09:00", "09:30");
  await page.goto(`/agenda?data=${DAY}`);
  await page.getByRole("button", { name: "Marcar consulta Dra. Ana às 09:00" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Paciente").fill("Paciente Ag");
  await dialog.getByRole("button", { name: /Paciente Agenda/ }).click();
  await dialog.getByRole("radio", { name: "Toda semana" }).click();
  await dialog.getByLabel("Quantas vezes").fill("3");
  await dialog.getByRole("button", { name: "Marcar consulta" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(/2 consultas marcadas\. Não deu para marcar: 11\/03\/2030/)).toBeVisible();
  const { count } = await admin().from("appointments").select("id", { count: "exact", head: true }).not("series_id", "is", null);
  expect(count).toBe(2);
});

test("desmarcar pede motivo e oferece o horário a quem está na lista de espera", async ({ page }) => {
  const { data: waiting } = await admin().from("patients").insert({ clinic_id: user.clinicId, full_name: "Paciente Espera" }).select("id").single();
  await admin().from("waitlist").insert({ clinic_id: user.clinicId, unit_id: seed.unitId, patient_id: waiting!.id, period: "afternoon" });
  await insertAppointment(DAY, "14:00", "14:30");

  await page.goto(`/agenda?data=${DAY}`);
  await page.getByRole("button", { name: /Paciente Agenda, 14:00/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Cancelado" }).click();
  await dialog.getByRole("button", { name: "Clínica desmarcou" }).click();
  await dialog.getByRole("button", { name: "Desmarcar consulta" }).click();
  await expect(dialog.getByText("Da lista de espera, cabem neste horário:")).toBeVisible();
  await dialog.getByRole("button", { name: "Encaixar" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(async () => (await admin().from("appointments").select("id").eq("patient_id", waiting!.id)).data?.length).toBe(1);
  await expect(page.getByRole("button", { name: /Paciente Espera, 14:00/ })).toBeVisible();

  await page.goto("/agenda/faltas?de=2030-03-01&ate=2030-03-10");
  await expect(page.getByText("Clínica desmarcou").last()).toBeVisible();
});

test("concluir a consulta permite agendar alerta de retorno", async ({ page }) => {
  await insertAppointment(DAY, "10:00", "10:30", { type: "Limpeza" });
  await page.goto(`/agenda?data=${DAY}`);
  await page.getByRole("button", { name: /Paciente Agenda, 10:00/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Concluído" }).click();
  await dialog.getByLabel("Retorno em (meses)").fill("1");
  await dialog.getByRole("button", { name: "Agendar alerta" }).click();
  await expect(dialog.getByText("Definir alerta de retorno?")).toBeHidden();
  const { data: ret } = await admin().from("patient_returns").select("id, reason").eq("patient_id", seed.patientId).single();
  expect(ret!.reason).toBe("Limpeza");
  // Traz o vencimento para hoje para aparecer na lista.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  await admin().from("patient_returns").update({ due_date: today }).eq("id", ret!.id);

  await page.goto("/agenda/retornos");
  await expect(page.getByText("Paciente Agenda")).toBeVisible();
  await page.getByRole("button", { name: "Dispensar" }).click();
  await expect(page.getByText("Paciente Agenda")).toBeHidden();
});

test("sala de espera mostra quem chegou com o tempo de espera", async ({ page }) => {
  const now = new Date();
  await admin().from("appointments").insert({
    clinic_id: user.clinicId,
    unit_id: seed.unitId,
    patient_id: seed.patientId,
    professional_id: seed.professionalId,
    starts_at: new Date(now.getTime() + 5 * 60_000).toISOString(),
    ends_at: new Date(now.getTime() + 35 * 60_000).toISOString(),
  });
  await admin().from("appointments").update({ status: "arrived", arrived_at: new Date(now.getTime() - 12 * 60_000).toISOString() }).eq("patient_id", seed.patientId);
  await page.goto("/agenda/sala-de-espera");
  await expect(page.getByText("Paciente Agenda")).toBeVisible();
  await expect(page.getByLabel("Tempo de espera")).toHaveText(/1[23] min/);
});

test("gestão cadastra marcador", async ({ page }) => {
  await page.goto("/configuracoes/marcadores");
  await expect(page.getByText("Urgência")).toBeVisible();
  await page.getByRole("button", { name: "Novo marcador" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome").fill("Paciente VIP");
  await dialog.getByRole("button", { name: "Criar marcador" }).click();
  await expect(page.getByText("Paciente VIP")).toBeVisible();
});
