import { expect, test, type Locator, type Page } from "@playwright/test";

import { admin, createTestUser, hasSupabase, seedAgenda, signIn, type TestUser } from "./support/test-user";

test.skip(!hasSupabase, "Precisa do Supabase configurado no .env.local");

// Segunda-feira no futuro: não depende do dia em que o teste roda.
const DAY = "2030-03-04";
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

async function newCommitment(page: Page, day = DAY) {
  await page.goto(`/agenda?data=${day}`);
  await page.getByRole("button", { name: "Novo", exact: true }).click();
  await page.getByRole("menuitem", { name: "Novo compromisso" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Novo compromisso" })).toBeVisible();
  return dialog;
}

const slot = (dialog: Locator, time: string) => dialog.getByRole("radiogroup", { name: "Horário" }).getByRole("radio", { name: time, exact: true });

const blocksOf = async () => {
  const { data } = await admin().from("schedule_blocks").select("id, title, series_id, starts_at, kind, all_day, professional_id").eq("clinic_id", user.clinicId).order("starts_at");
  return data ?? [];
};

test("almoço de seg a sex por 4 semanas: 20 ocorrências e a grade da consulta não oferece o horário", async ({ page }) => {
  const dialog = await newCommitment(page);
  await dialog.getByRole("button", { name: "Almoço", exact: true }).click();
  await dialog.getByRole("button", { name: "12:00", exact: true }).click();
  await dialog.getByRole("button", { name: "12:45", exact: true }).click();
  await expect(dialog.getByText("Seg, 04/03 · 12:00–13:00 · Dra. Ana")).toBeVisible();
  await dialog.getByRole("radio", { name: "Todo dia útil (seg–sex)" }).click();
  await dialog.getByLabel("Até (data)").fill("2030-03-29");
  await dialog.getByRole("button", { name: "Criar compromisso" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("20 compromissos criados.")).toBeVisible();

  const rows = await blocksOf();
  expect(rows).toHaveLength(20);
  expect(new Set(rows.map((r) => r.series_id)).size).toBe(1);
  expect(rows[0]!.series_id).not.toBeNull();
  expect(rows.every((r) => r.professional_id === seed.professionalId && r.kind === "block")).toBe(true);

  // Quarta da segunda semana: a grade não oferece 12:00–13:00.
  await page.goto("/agenda?data=2030-03-13");
  await page.getByRole("button", { name: "Nova consulta" }).click();
  const appt = page.getByRole("dialog");
  await expect(slot(appt, "11:30")).toBeVisible();
  for (const t of ["11:45", "12:00", "12:30"]) await expect(slot(appt, t)).toHaveCount(0);
  await expect(slot(appt, "13:00")).toBeVisible();
});

test("feriado de dia inteiro para a clínica toda: faixa no topo e nenhum horário livre", async ({ page }) => {
  const dialog = await newCommitment(page);
  await dialog.getByRole("button", { name: "Feriado", exact: true }).click();
  await dialog.getByRole("radio", { name: "Clínica toda" }).click();
  await dialog.getByRole("switch", { name: "Dia inteiro" }).click();
  await dialog.getByRole("button", { name: "Criar compromisso" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Feriado, dia inteiro, bloqueado" })).toBeVisible();
  const [row] = await blocksOf();
  expect(row).toMatchObject({ all_day: true, professional_id: null, kind: "block" });

  await page.getByRole("button", { name: "Nova consulta" }).click();
  await expect(page.getByRole("dialog").getByText("Nenhum horário livre neste dia com essa duração.")).toBeVisible();
});

test("evento não bloqueia: a consulta continua podendo ser marcada no horário", async ({ page }) => {
  const dialog = await newCommitment(page);
  await dialog.getByLabel("Nome", { exact: true }).fill("Reunião de equipe");
  await dialog.getByRole("switch", { name: "Bloqueia a agenda" }).click();
  await dialog.getByRole("button", { name: "10:00", exact: true }).click();
  await dialog.getByRole("button", { name: "10:45", exact: true }).click();
  await dialog.getByRole("button", { name: "Criar compromisso" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: /Reunião de equipe · 10:00–11:00, lembrete/ })).toBeVisible();

  await page.getByRole("button", { name: "Nova consulta" }).click();
  await expect(slot(page.getByRole("dialog"), "10:15")).toBeVisible();
});

test("série pula a data que já tem consulta e avisa", async ({ page }) => {
  await admin().from("appointments").insert({
    clinic_id: user.clinicId,
    unit_id: seed.unitId,
    patient_id: seed.patientId,
    professional_id: seed.professionalId,
    starts_at: at("2030-03-11", "12:15"),
    ends_at: at("2030-03-11", "12:45"),
  });
  const dialog = await newCommitment(page);
  await dialog.getByRole("button", { name: "Curso", exact: true }).click();
  await dialog.getByRole("button", { name: "12:00", exact: true }).click();
  await dialog.getByRole("button", { name: "12:45", exact: true }).click();
  await dialog.getByRole("radio", { name: "Toda semana" }).click();
  await dialog.getByRole("radio", { name: "Quantas vezes" }).click();
  await dialog.getByLabel("Quantas vezes", { exact: true }).fill("3");
  await dialog.getByRole("button", { name: "Criar compromisso" }).click();
  await expect(page.getByText("2 compromissos criados. 1 data não foi criada porque já tem consulta: 11/03/2030.")).toBeVisible();
  expect((await blocksOf()).map((r) => r.starts_at.slice(0, 10))).toEqual(["2030-03-04", "2030-03-18"]);
});

test("editar 'Este e os próximos' muda só as ocorrências futuras; excluir 'Todos' apaga a série", async ({ page }) => {
  const seriesId = crypto.randomUUID();
  await admin()
    .from("schedule_blocks")
    .insert(
      ["2030-03-04", "2030-03-11", "2030-03-18"].map((day) => ({
        clinic_id: user.clinicId,
        unit_id: seed.unitId,
        professional_id: seed.professionalId,
        title: "Almoço",
        kind: "block",
        notes: null,
        all_day: false,
        series_id: seriesId,
        starts_at: at(day, "12:00"),
        ends_at: at(day, "13:00"),
      })),
    );
  await page.goto("/agenda?data=2030-03-11");
  await page.getByRole("button", { name: /Almoço · 12:00–13:00/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Se repete")).toBeVisible();
  await dialog.getByRole("button", { name: "Editar" }).click();
  await dialog.getByLabel("Nome", { exact: true }).fill("Almoço curto");
  await dialog.getByRole("button", { name: "13:00", exact: true }).click(); // recomeça a faixa
  await dialog.getByRole("button", { name: "12:00", exact: true }).click();
  await dialog.getByRole("button", { name: "12:15", exact: true }).click();
  await dialog.getByRole("button", { name: "Salvar alterações" }).click();
  await dialog.getByRole("button", { name: "Este e os próximos" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("2 compromissos alterados.")).toBeVisible();

  const rows = await blocksOf();
  expect(rows.map((r) => [r.starts_at.slice(0, 10), r.title])).toEqual([
    ["2030-03-04", "Almoço"],
    ["2030-03-11", "Almoço curto"],
    ["2030-03-18", "Almoço curto"],
  ]);
  // Cada ocorrência ficou no seu dia, com o horário novo.
  const { data: end } = await admin().from("schedule_blocks").select("ends_at").eq("id", rows[2]!.id).single();
  expect(new Date(end!.ends_at).toISOString()).toBe(new Date(at("2030-03-18", "12:30")).toISOString());

  await page.getByRole("button", { name: /Almoço curto · 12:00–12:30/ }).click();
  await dialog.getByRole("button", { name: "Excluir" }).click();
  await dialog.getByRole("button", { name: "Todos" }).click();
  await expect(page.getByText("3 compromissos excluídos.")).toBeVisible();
  expect(await blocksOf()).toEqual([]);
});

test("alerta de retorno pelo menu + Novo", async ({ page }) => {
  await page.goto(`/agenda?data=${DAY}`);
  await page.getByRole("button", { name: "Novo", exact: true }).click();
  await page.getByRole("menuitem", { name: "Alerta de retorno" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Paciente").fill("Paciente Ag");
  await dialog.getByRole("button", { name: /Paciente Agenda/ }).click();
  await dialog.getByLabel("Retorno em (meses)").fill("3");
  await dialog.getByLabel("Motivo").fill("Manutenção");
  await dialog.getByRole("button", { name: "Criar alerta" }).click();
  await expect(page.getByText("Alerta de retorno criado para Paciente Agenda.")).toBeVisible();
  const { data } = await admin().from("patient_returns").select("reason, status").eq("patient_id", seed.patientId).single();
  expect(data).toEqual({ reason: "Manutenção", status: "pending" });
});

test("abas: de Nova consulta para Compromisso levando o dia", async ({ page }) => {
  await page.goto(`/agenda?data=${DAY}`);
  await page.getByRole("button", { name: "Marcar consulta Dra. Ana às 09:00" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: "Compromisso" }).click();
  await expect(dialog.getByRole("heading", { name: "Novo compromisso" })).toBeVisible();
  await expect(dialog.getByLabel("Data")).toHaveValue(DAY);
  await expect(dialog.getByRole("button", { name: "09:00, início" })).toBeVisible();
});
