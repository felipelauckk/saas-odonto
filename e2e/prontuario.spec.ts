import { expect, test } from "@playwright/test";

import { admin, createTestUser, hasSupabase, seedClinical, signIn, type TestUser } from "./support/test-user";

test.skip(!hasSupabase, "Precisa do Supabase configurado no .env.local");

let user: TestUser;
let patientId: string;

test.beforeEach(async ({ page }) => {
  user = await createTestUser();
  ({ patientId } = await seedClinical(user));
  await signIn(page, user);
});

test.afterEach(async () => {
  await user.cleanup();
});

test("preenche a anamnese, mostra o alerta e guarda versões", async ({ page }) => {
  await page.goto(`/pacientes/${patientId}/anamnese`);
  await page.getByRole("button", { name: "Preencher anamnese" }).click();

  const allergy = page.getByRole("group", { name: /Tem alergia a algum medicamento/ });
  await allergy.getByRole("button", { name: "Sim" }).click();
  await page.getByLabel(/Detalhes: Tem alergia/).fill("Penicilina");
  await page.getByRole("group", { name: /Fuma\?/ }).getByRole("button", { name: "Não" }).click();
  await page.getByRole("button", { name: "Salvar anamnese" }).click();

  const banner = page.getByRole("note", { name: "Alertas da anamnese" });
  await expect(banner).toContainText("Penicilina");
  await expect(page.getByText("Versão atual")).toBeVisible();

  // Nova versão: a alergia foi descartada.
  await page.getByRole("button", { name: "Atualizar anamnese" }).click();
  await page.getByRole("group", { name: /Tem alergia a algum medicamento/ }).getByRole("button", { name: "Não" }).click();
  await page.getByRole("button", { name: "Salvar anamnese" }).click();
  await expect(banner).toBeHidden();
  await expect(page.getByText("Histórico de versões")).toBeVisible();
  await page.getByRole("button", { name: /\d{2}\/\d{2}\/\d{4}/ }).last().click();
  await expect(page.getByText("Versão anterior")).toBeVisible();
  await expect(page.getByText("Sim — Penicilina")).toBeVisible();
});

test("registra cárie numa face do odontograma", async ({ page }) => {
  await page.goto(`/pacientes/${patientId}/odontograma`);
  await page.getByRole("button", { name: "Dente 16, face Oclusal" }).click();
  await page.getByRole("button", { name: "Dente 16, face Mesial" }).click();
  await expect(page.getByText("Faces: Oclusal, Mesial")).toBeVisible();
  await page.getByRole("group", { name: "Condição" }).getByRole("button", { name: "Cárie" }).click();
  await page.getByRole("button", { name: "Registrar" }).click();

  await expect(page.getByText("Dente 16: Cárie registrado.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Dente 16, face Oclusal: Cárie" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Histórico do dente 16" })).toContainText("Cárie · Oclusal, Mesial");

  // Dente inteiro: ausente.
  await page.getByRole("button", { name: "Dente 48 inteiro" }).click();
  await page.getByRole("group", { name: "Condição" }).getByRole("button", { name: "Ausente" }).click();
  await page.getByRole("button", { name: "Registrar" }).click();
  await expect(page.getByRole("button", { name: "Dente 48 inteiro: Ausente" })).toBeVisible();

  await page.getByRole("radio", { name: "Histórico" }).click();
  await expect(page.getByText("Dente 16 (Oclusal, Mesial): Cárie")).toBeVisible();

  await page.getByRole("radio", { name: "Decíduos" }).click();
  await expect(page.getByRole("button", { name: "Dente 55 inteiro" })).toBeVisible();
});

test("registra evolução e complementa, sem opção de editar", async ({ page }) => {
  await page.goto(`/pacientes/${patientId}/evolucoes`);
  await page.getByRole("textbox", { name: "Nova evolução" }).fill("Profilaxia realizada. Orientado sobre fio dental.");
  await page.getByRole("button", { name: "Registrar evolução" }).click();

  const note = page.getByRole("article").filter({ hasText: "Profilaxia realizada" });
  await expect(note).toContainText("Dr. Dono");
  await expect(note.getByRole("button", { name: /Editar|Apagar/ })).toHaveCount(0);

  await note.getByRole("button", { name: "Complementar" }).click();
  await page.getByLabel("Complemento").fill("Retorno em 6 meses.");
  await page.getByRole("button", { name: "Salvar complemento" }).click();
  await expect(note).toContainText("Retorno em 6 meses.");
});

test("envia radiografia direto para o Storage e mostra na galeria", async ({ page }) => {
  await page.goto(`/pacientes/${patientId}/arquivos`);
  await expect(page.getByText("Nenhum arquivo")).toBeVisible();

  // PNG de 1x1 pixel.
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  );
  await page.locator("#arquivos-paciente").setInputFiles({ name: "panoramica.png", mimeType: "image/png", buffer: png });
  await page.getByLabel("Descrição (opcional)").fill("Panorâmica inicial");
  await page.getByRole("button", { name: "Enviar", exact: true }).click();

  await expect(page.getByText("Arquivo enviado.")).toBeVisible();
  await expect(page.getByRole("img", { name: "Panorâmica inicial" })).toBeVisible();

  const { data } = await admin().from("patient_files").select("storage_path, kind").eq("patient_id", patientId);
  expect(data).toHaveLength(1);
  expect(data![0]!.kind).toBe("xray");
  expect(data![0]!.storage_path.startsWith(`${user.clinicId}/patients/${patientId}/`)).toBe(true);
});

test("modelo de anamnese editável em Configurações", async ({ page }) => {
  await page.goto("/configuracoes/anamnese");
  await page.getByRole("button", { name: "Adicionar pergunta" }).click();
  const last = page.getByRole("listitem").last();
  await last.getByRole("textbox").fill("Usa aparelho ortodôntico?");
  await last.getByText("“Sim” vira alerta").click();
  await page.getByRole("button", { name: "Salvar modelo" }).click();
  await expect(page.getByText(/Modelo salvo/)).toBeVisible();

  await page.goto(`/pacientes/${patientId}/anamnese`);
  await page.getByRole("button", { name: "Preencher anamnese" }).click();
  await page.getByRole("group", { name: /Usa aparelho ortodôntico/ }).getByRole("button", { name: "Sim" }).click();
  await page.getByRole("button", { name: "Salvar anamnese" }).click();
  await expect(page.getByRole("note", { name: "Alertas da anamnese" })).toContainText("Usa aparelho ortodôntico?");
});
