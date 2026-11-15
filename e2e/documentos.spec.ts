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

test("emite atestado, envia link e o paciente assina pelo celular sem login", async ({ page, browser }) => {
  await page.goto(`/pacientes/${patientId}/documentos`);
  await page.getByRole("button", { name: "Novo documento" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Modelo").click();
  await page.getByRole("option", { name: "Atestado · Atestado odontológico" }).click();
  await dialog.getByLabel("Dias de afastamento").fill("2");
  await dialog.getByRole("button", { name: "Pré-visualizar" }).click();
  await expect(dialog.getByLabel("Texto")).toHaveValue(/Paciente Prontuário.*2 dia\(s\) de afastamento/s);
  await dialog.getByRole("button", { name: "Emitir documento" }).click();
  await expect(dialog).toBeHidden();

  const row = page.getByRole("listitem").filter({ hasText: "Atestado odontológico" });
  await expect(row).toContainText("Emitido");
  const pdf = await page.request.get(`/documentos/${await row.getByRole("link", { name: "PDF" }).getAttribute("href").then((h) => h!.split("/")[2])}/arquivo`);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");

  await row.getByRole("button", { name: "Enviar para assinar" }).click();
  await page.getByRole("button", { name: "Gerar link" }).click();
  const url = await page.getByLabel("Link de assinatura").inputValue();
  expect(url).toMatch(/\/assinar\/[A-Za-z0-9_-]{43}$/);
  await expect(page.getByRole("link", { name: "Abrir no WhatsApp" })).toHaveAttribute("href", /wa\.me/);
  await page.keyboard.press("Escape");

  // Paciente: outro navegador, sem login.
  const patientContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const patient = await patientContext.newPage();
  await patient.goto(url);
  await expect(patient.getByRole("heading", { name: "Atestado odontológico" })).toBeVisible();
  await expect(patient.getByText(/2 dia\(s\) de afastamento/)).toBeVisible();
  await expect(patient.getByText("Prontuário", { exact: false }).first()).toBeVisible(); // o nome no documento
  await expect(patient.getByText("Dados do paciente")).toHaveCount(0);

  await patient.getByText("Li o documento acima e concordo").click();
  await patient.getByLabel("Seu nome completo").fill("Paciente Prontuário");
  const pad = patient.getByLabel(/Quadro de assinatura/);
  const box = (await pad.boundingBox())!;
  await patient.mouse.move(box.x + 30, box.y + 80);
  await patient.mouse.down();
  for (let i = 1; i <= 20; i++) await patient.mouse.move(box.x + 30 + i * 12, box.y + 80 - Math.sin(i / 2) * 40);
  await patient.mouse.up();
  await patient.getByRole("button", { name: "Assinar documento" }).click();
  await expect(patient.getByText("Documento assinado")).toBeVisible();

  // Link de uso único.
  await patient.reload();
  await expect(patient.getByRole("heading", { name: "Este link já foi usado" })).toBeVisible();
  await patientContext.close();

  await page.reload();
  await expect(row).toContainText("Assinado por Paciente Prontuário");
  const signedHref = await row.getByRole("link", { name: "PDF assinado" }).getAttribute("href");
  const signedPdf = await page.request.get(signedHref!);
  expect(signedPdf.headers()["content-type"]).toBe("application/pdf");
});

test("link inexistente mostra mensagem neutra", async ({ browser }) => {
  const context = await browser.newContext();
  const anon = await context.newPage();
  await anon.goto(`/assinar/${"a".repeat(43)}`);
  await expect(anon.getByRole("heading", { name: "Link indisponível" })).toBeVisible();
  await context.close();
  expect((await admin().from("signature_requests").select("id").eq("clinic_id", user.clinicId)).data).toEqual([]);
});
