import { expect, test } from "@playwright/test";

import { admin, createTestUser, hasSupabase, seedAgenda, signIn, type TestUser } from "./support/test-user";

test.skip(!hasSupabase, "Precisa do Supabase configurado no .env.local");

let user: TestUser;
let seed: Awaited<ReturnType<typeof seedAgenda>>;

const isoDay = (offset: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(Date.now() + offset * 86_400_000));

test.beforeEach(async ({ page }) => {
  user = await createTestUser();
  seed = await seedAgenda(user);
  const day = isoDay(-2);
  const { data: appt } = await admin()
    .from("appointments")
    .insert({ clinic_id: user.clinicId, unit_id: seed.unitId, patient_id: seed.patientId, professional_id: seed.professionalId, starts_at: `${day}T09:00:00-03:00`, ends_at: `${day}T09:30:00-03:00` })
    .select("id")
    .single();
  await admin().from("appointments").update({ status: "no_show" }).eq("id", appt!.id);
  await signIn(page, user);
});

test.afterEach(async () => {
  await user.cleanup();
});

test("falta na primeira consulta aparece na CRC; contato com retorno marcado sai da fila", async ({ page }) => {
  await page.goto("/crc");
  await expect(page.getByRole("link", { name: "Faltas na primeira consulta 1" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "Paciente Agenda" })).toBeVisible();
  await expect(page.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", /wa\.me\/5511988887777\?text=.*Sentimos%20sua%20falta/);

  await page.getByRole("button", { name: "Registrar contato" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Vai pensar" }).click();
  await dialog.getByLabel("Observação (opcional)").fill("Pediu para ligar semana que vem");
  await dialog.getByLabel("Próximo contato (opcional)").fill(isoDay(7));
  await dialog.getByRole("button", { name: "Registrar" }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByText("Fila em dia")).toBeVisible();
  await page.getByRole("link", { name: "Para depois (1)" }).click();
  await expect(page.getByText(/Último contato: .* · Ligação · Vai pensar · Próximo contato em/)).toBeVisible();
});

test("agendar pela CRC abre a nova consulta com o paciente", async ({ page }) => {
  await page.goto("/crc?fila=first_visit_no_shows");
  await page.getByRole("link", { name: "Agendar" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Paciente Agenda")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Marcar consulta" })).toBeVisible();
});

test("indicadores e mensagens da CRC", async ({ page }) => {
  await page.goto("/crc/indicadores");
  await expect(page.getByRole("cell", { name: "Orçamentos em aberto" })).toBeVisible();
  await page.goto("/configuracoes/mensagens");
  await expect(page.getByLabel("Inadimplentes")).toHaveValue(/\{\{valor\}\}/);
});
