import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { admin, createTestUser, hasSupabase, seedAgenda, signIn, type TestUser } from "./support/test-user";

test.skip(!hasSupabase, "Precisa do Supabase configurado no .env.local");

const DAY = "2030-03-04";
const at = (time: string) => `${DAY}T${time}:00-03:00`;

let user: TestUser;
let seed: Awaited<ReturnType<typeof seedAgenda>>;

test.beforeEach(async () => {
  user = await createTestUser();
  seed = await seedAgenda(user);
  await admin().from("appointments").insert({
    clinic_id: user.clinicId,
    unit_id: seed.unitId,
    patient_id: seed.patientId,
    professional_id: seed.professionalId,
    starts_at: at("14:00"),
    ends_at: at("14:30"),
    type: "Avaliação",
  });
});

test.afterEach(async () => {
  await user.cleanup();
});

async function openCard(page: Page) {
  await page.goto(`/agenda?data=${DAY}`);
  const card = page.getByRole("button", { name: /Paciente Agenda, 14:00/ });
  // Medido antes: com o cartão aberto, o fundo fica inerte para leitores de tela.
  const anchor = (await card.boundingBox())!;
  await card.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Paciente Agenda" })).toBeVisible();
  await dialog.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  // Espera os dados do cartão (quem agendou) chegarem.
  await expect(dialog.getByText(/^Agendado/)).toBeVisible();
  return { anchor, dialog };
}

test("no computador o cartão tem 440px e abre ao lado da consulta; o status muda a agenda", async ({ page, isMobile }) => {
  test.skip(isMobile, "Posição ao lado só no computador");
  await page.setViewportSize({ width: 1280, height: 800 });
  await signIn(page, user);
  const { anchor, dialog } = await openCard(page);
  const box = (await dialog.boundingBox())!;
  expect(Math.round(box.width)).toBe(440);
  // Inteiro dentro da tela.
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(800);
  // Ao lado da consulta quando cabe; numa coluna larga, nunca cobre a consulta inteira.
  const beside = box.x >= anchor.x + anchor.width || box.x + box.width <= anchor.x;
  const covered = Math.max(0, Math.min(box.x + box.width, anchor.x + anchor.width) - Math.max(box.x, anchor.x));
  expect(beside || covered < anchor.width).toBe(true);

  await expect(dialog.getByText("Primeira vez")).toBeVisible();
  await expect(dialog.getByText("Financeiro em dia")).toBeVisible();
  await expect(dialog.getByText("Nenhuma cobrança")).toBeVisible();
  await expect(dialog.getByText("Aguardando confirmação")).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Financeiro" })).toBeVisible();

  await dialog.getByRole("button", { name: "Status: Agendado" }).click();
  await page.getByRole("menuitem", { name: "Confirmado" }).click();
  await expect(dialog.getByRole("button", { name: "Status: Confirmado" })).toBeVisible();
  await expect(dialog.getByText(/^Confirmado em \d\d\/\d\d$/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Paciente Agenda, 14:00 a 14:30, Confirmado" })).toBeVisible();
});

test("com duas colunas, o cartão abre exatamente ao lado da consulta", async ({ page, isMobile }) => {
  test.skip(isMobile, "Posição ao lado só no computador");
  await admin().from("professionals").insert([{ clinic_id: user.clinicId, name: "Dr. Beto" }, { clinic_id: user.clinicId, name: "Dra. Carla" }]);
  await page.setViewportSize({ width: 1280, height: 800 });
  await signIn(page, user);
  const { anchor, dialog } = await openCard(page);
  const box = (await dialog.boundingBox())!;
  expect(box.x >= anchor.x + anchor.width || box.x + box.width <= anchor.x).toBe(true);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(1280);
});

test("pagamento vencido: Receber dá baixa e o cartão fica em dia", async ({ page }) => {
  await admin().from("receivables").insert({ clinic_id: user.clinicId, unit_id: seed.unitId, patient_id: seed.patientId, description: "Taxa de avaliação", amount_cents: 12000, due_date: "2026-01-10", status: "open" });
  await signIn(page, user);
  const { dialog } = await openCard(page);
  await expect(dialog.getByText(/Pagamento pendente · R\$\s120,00 vencido/)).toBeVisible();
  await dialog.getByRole("button", { name: "Receber" }).click();
  await dialog.getByRole("button", { name: "Confirmar recebimento" }).click();
  await expect(dialog.getByText("Recebimento registrado.")).toBeVisible();
  await expect(dialog.getByText("Financeiro em dia")).toBeVisible();
  const { data } = await admin().from("receivables").select("status").eq("patient_id", seed.patientId).single();
  expect(data!.status).toBe("paid");
});

test("marcadores entram e saem direto do cartão", async ({ page }) => {
  await signIn(page, user);
  const { dialog } = await openCard(page);
  await dialog.getByRole("button", { name: "Adicionar" }).click();
  await page.getByRole("menuitem", { name: "Urgência" }).click();
  await expect(dialog.getByRole("button", { name: "Tirar marcador Urgência" })).toBeVisible();
  await expect.poll(async () => (await admin().from("appointment_tag_links").select("tag_id").eq("clinic_id", user.clinicId)).data?.length).toBe(1);
  await dialog.getByRole("button", { name: "Tirar marcador Urgência" }).click();
  await expect.poll(async () => (await admin().from("appointment_tag_links").select("tag_id").eq("clinic_id", user.clinicId)).data?.length).toBe(0);
});

test("gestão exclui consulta sem evolução", async ({ page }) => {
  await signIn(page, user);
  const { dialog } = await openCard(page);
  await dialog.getByRole("button", { name: "Mais ações" }).click();
  await page.getByRole("menuitem", { name: "Excluir", exact: true }).click();
  await dialog.getByRole("button", { name: "Excluir consulta" }).click();
  await expect(page.getByText("Consulta excluída.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Paciente Agenda, 14:00/ })).toHaveCount(0);
});

test("no celular o cartão vira folha de baixo para cima", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Só no celular");
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, user);
  const { dialog } = await openCard(page);
  const box = (await dialog.boundingBox())!;
  expect(Math.round(box.width)).toBe(390);
  expect(Math.round(box.y + box.height)).toBe(844);
});

test("o dentista não vê a faixa financeira nem o atalho Financeiro", async ({ page }) => {
  const client = admin();
  const email = `e2e-dent-${randomUUID().slice(0, 8)}@example.com`;
  const password = `E2e-${randomUUID()}`;
  const { data: created } = await client.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: "Dentista Teste" } });
  const dentistId = created.user!.id;
  try {
    const { data: member } = await client.from("clinic_members").insert({ clinic_id: user.clinicId, user_id: dentistId, role: "dentist" }).select("id").single();
    await client.from("professionals").update({ member_id: member!.id }).eq("id", seed.professionalId);
    await client.from("profiles").update({ active_clinic_id: user.clinicId }).eq("id", dentistId);
    await admin().from("receivables").insert({ clinic_id: user.clinicId, unit_id: seed.unitId, patient_id: seed.patientId, description: "Taxa", amount_cents: 5000, due_date: "2026-01-10", status: "open", professional_id: seed.professionalId });

    await page.goto("/entrar");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/entrar"));
    const { dialog } = await openCard(page);
    await expect(dialog.getByRole("link", { name: "Ficha" })).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Financeiro" })).toHaveCount(0);
    await expect(dialog.getByText(/Financeiro em dia|Pagamento pendente|Carregando o financeiro/)).toHaveCount(0);
  } finally {
    await client.from("clinic_members").delete().eq("user_id", dentistId);
    await client.auth.admin.deleteUser(dentistId);
  }
});
