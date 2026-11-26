import { expect, test, type Locator, type Page } from "@playwright/test";

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

async function selectOption(page: Page, label: string, option: string) {
  await page.getByLabel(label, { exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

/** Botão de um horário livre na grade da "Nova consulta". */
const slot = (dialog: Locator, time: string) => dialog.getByRole("radiogroup", { name: "Horário" }).getByRole("radio", { name: time, exact: true });

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
  // O horário clicado na grade já vem escolhido.
  await expect(slot(dialog, "09:00")).toHaveAttribute("aria-checked", "true");
  await dialog.getByRole("button", { name: "Marcar consulta" }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByRole("button", { name: "Paciente Agenda, 09:00 a 09:30, Agendado" })).toBeVisible();
});

test("a grade não oferece horário ocupado por consulta", async ({ page }) => {
  await insertAppointment("10:00", "11:00");
  await page.goto(`/agenda?data=${DAY}`);

  await page.getByRole("button", { name: "Nova consulta" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Data").fill(DAY);
  await expect(slot(dialog, "09:30")).toBeVisible();
  // 30 min a partir das 09:45 já encosta na consulta das 10:00.
  for (const t of ["09:45", "10:00", "10:30", "10:45"]) await expect(slot(dialog, t)).toHaveCount(0);
  await expect(slot(dialog, "11:00")).toBeVisible();
  // Duração maior recalcula a grade.
  await selectOption(page, "Duração", "1h");
  await expect(slot(dialog, "09:15")).toHaveCount(0);
  await expect(slot(dialog, "09:00")).toBeVisible();
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
  await page.getByRole("button", { name: "Novo", exact: true }).click();
  await page.getByRole("menuitem", { name: "Novo compromisso" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Almoço", exact: true }).click();
  await dialog.getByRole("button", { name: "12:00", exact: true }).click();
  await dialog.getByRole("button", { name: "12:45", exact: true }).click();
  await dialog.getByRole("button", { name: "Criar compromisso" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: /Almoço · 12:00–13:00/ })).toBeVisible();

  // A grade da consulta não oferece o horário bloqueado.
  await page.getByRole("button", { name: "Nova consulta" }).click();
  await expect(slot(dialog, "11:30")).toBeVisible();
  for (const t of ["11:45", "12:00", "12:15", "12:45"]) await expect(slot(dialog, t)).toHaveCount(0);
  await expect(slot(dialog, "13:00")).toBeVisible();
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
  await slot(dialog, "15:30").click();
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

test("marca consulta com 3 procedimentos, um do plano, e um item do plano escrito à mão", async ({ page }) => {
  const client = admin();
  const { data: procs } = await client
    .from("procedures")
    .insert([
      { clinic_id: user.clinicId, name: "Restauração P1", duration_min: 40 },
      { clinic_id: user.clinicId, name: "Profilaxia P1", duration_min: 30 },
      { clinic_id: user.clinicId, name: "Raspagem P1", duration_min: 20 },
    ])
    .select("id, name");
  const restauracao = procs!.find((p) => p.name === "Restauração P1")!.id;
  const { data: plan } = await client
    .from("treatment_plans")
    .insert({ clinic_id: user.clinicId, unit_id: seed.unitId, patient_id: seed.patientId, professional_id: seed.professionalId, status: "draft" })
    .select("id")
    .single();
  await client.from("treatment_items").insert([
    { clinic_id: user.clinicId, plan_id: plan!.id, procedure_id: restauracao, description: "Restauração P1", tooth: 36, faces: ["O"], price_cents: 20000, position: 0 },
    // Escrito à mão no orçamento, sem procedimento cadastrado.
    { clinic_id: user.clinicId, plan_id: plan!.id, procedure_id: null, description: "Ajuste oclusal P1", tooth: null, faces: [], price_cents: 5000, position: 1 },
  ]);
  await client.from("treatment_plans").update({ status: "approved", approved_at: new Date().toISOString() }).eq("id", plan!.id);
  await client.from("treatment_items").update({ status: "approved" }).eq("plan_id", plan!.id);

  await page.goto(`/agenda?data=${DAY}`);
  await page.getByRole("button", { name: "Marcar consulta Dra. Ana às 09:00" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Paciente").fill("Paciente Ag");
  await dialog.getByRole("button", { name: /Paciente Agenda/ }).click();
  await expect(dialog.getByText("WhatsApp (11) 98888-7777")).toBeVisible();
  await expect(dialog.getByText("Primeira vez")).toBeVisible();

  await dialog.getByRole("button", { name: "Adicionar procedimento" }).click();
  await expect(dialog.getByText("Do plano de tratamento")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Incluir do plano: Ajuste oclusal P1" })).toBeVisible();
  await dialog.getByRole("button", { name: "Incluir do plano: Restauração P1, dente 36" }).click();
  for (const name of ["Profilaxia P1", "Raspagem P1"]) {
    await dialog.getByRole("button", { name: "Adicionar procedimento" }).click();
    // Item do plano já incluído não aparece de novo.
    await expect(dialog.getByRole("button", { name: /Incluir do plano: Restauração/ })).toHaveCount(0);
    await dialog.getByPlaceholder("Buscar procedimento").fill(name.slice(0, 6));
    await dialog.getByRole("button", { name: `Incluir ${name}` }).click();
  }
  // Item do plano escrito à mão: entra sem duração (não muda a soma).
  await dialog.getByRole("button", { name: "Adicionar procedimento" }).click();
  await dialog.getByRole("button", { name: "Incluir do plano: Ajuste oclusal P1" }).click();
  // 40 + 30 + 20 min.
  await expect(dialog.getByLabel("Duração", { exact: true })).toContainText("1h30");
  await expect(slot(dialog, "09:00")).toHaveAttribute("aria-checked", "true");
  await expect(dialog.getByText("Seg, 04/03 · 09:00–10:30 · Dra. Ana")).toBeVisible();
  await dialog.getByRole("radio", { name: "Não enviar" }).last().click();
  await dialog.getByRole("button", { name: "Marcar consulta" }).click();
  await expect(dialog).toBeHidden();

  const { data: appt } = await client
    .from("appointments")
    .select("id, starts_at, ends_at, reminder_mode, appointment_procedures(position, tooth, treatment_item_id, procedure_id, description)")
    .eq("patient_id", seed.patientId)
    .single();
  expect(appt!.reminder_mode).toBe("none");
  expect((Date.parse(appt!.ends_at) - Date.parse(appt!.starts_at)) / 60_000).toBe(90);
  const list = [...appt!.appointment_procedures].sort((a, b) => a.position - b.position);
  const idOf = (name: string) => procs!.find((p) => p.name === name)!.id;
  expect(list.map((p) => p.procedure_id)).toEqual([idOf("Restauração P1"), idOf("Profilaxia P1"), idOf("Raspagem P1"), null]);
  expect(list[3]!.description).toBe("Ajuste oclusal P1");
  expect(list[0]!.tooth).toBe(36);
  expect(list[0]!.treatment_item_id).not.toBeNull();

  // Os quatro aparecem nos detalhes da consulta.
  await page.getByRole("button", { name: /Paciente Agenda, 09:00/ }).click();
  const details = page.getByRole("dialog").getByRole("list", { name: "Procedimentos" });
  await expect(details.getByRole("listitem")).toHaveCount(4);
  await expect(details.getByText("Ajuste oclusal P1")).toBeVisible();
});

test("no celular, a nova consulta ocupa a tela e o rodapé fica fixo", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Só no celular");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/agenda?data=${DAY}`);
  await page.getByRole("button", { name: "Nova consulta" }).first().click();
  const dialog = page.getByRole("dialog");
  // Mede depois da animação de abertura (que começa em 95% do tamanho).
  await dialog.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  const box = (await dialog.boundingBox())!;
  expect(Math.round(box.width)).toBe(390);
  expect(Math.round(box.height)).toBe(844);
  // Manhã: 4 horários por linha.
  const radios = dialog.getByRole("radiogroup", { name: "Horário" }).getByRole("radio");
  await expect(radios.first()).toBeVisible();
  const tops = await radios.evaluateAll((els) => els.slice(0, 5).map((el) => Math.round(el.getBoundingClientRect().top)));
  expect(tops.slice(0, 4).every((t) => t === tops[0])).toBe(true);
  expect(tops[4]).toBeGreaterThan(tops[0]!);
  const submit = dialog.getByRole("button", { name: "Marcar consulta" });
  const before = (await submit.boundingBox())!.y;
  await dialog.getByLabel("Observações").scrollIntoViewIfNeeded();
  expect((await submit.boundingBox())!.y).toBe(before);
  expect(before + 44).toBeLessThanOrEqual(844);
});
