import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { admin, createTestUser, hasSupabase, seedAgenda, signIn, type TestUser } from "./support/test-user";

test.skip(!hasSupabase, "Precisa do Supabase configurado no .env.local");

let user: TestUser;

test.beforeEach(async ({ page }) => {
  user = await createTestUser();
  const seed = await seedAgenda(user);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(Date.now() - 86_400_000));
  const { data } = await admin()
    .from("appointments")
    .insert({ clinic_id: user.clinicId, unit_id: seed.unitId, patient_id: seed.patientId, professional_id: seed.professionalId, starts_at: `${day}T09:00:00-03:00`, ends_at: `${day}T09:30:00-03:00` })
    .select("id")
    .single();
  await admin().from("appointments").update({ status: "no_show" }).eq("id", data!.id);
  await signIn(page, user);
});

test.afterEach(async () => {
  await user.cleanup();
});

test("abre um relatório e exporta Excel e CSV", async ({ page }) => {
  await page.goto("/relatorios");
  await page.getByRole("link", { name: /Faltas e desmarcações/ }).click();
  await expect(page.getByRole("heading", { name: "Faltas e desmarcações" })).toBeVisible();
  await page.getByLabel("De").fill("2026-01-01");
  await page.getByRole("button", { name: "Aplicar" }).click();
  await expect(page.getByRole("cell", { name: "Dra. Ana" })).toBeVisible();

  const [xlsx] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Excel" }).click()]);
  expect(xlsx.suggestedFilename()).toMatch(/^faltas-2026-01-01-a-\d{4}-\d{2}-\d{2}\.xlsx$/);
  expect(readFileSync(await xlsx.path()).subarray(0, 2).toString()).toBe("PK");

  const [csv] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "CSV" }).click()]);
  const text = readFileSync(await csv.path(), "utf8");
  expect(text).toContain("Profissional;Consultas passadas;Faltas;Taxa de faltas (%)");
  expect(text).toMatch(/Dra\. Ana;1;1;100/);
});

test("todos os relatórios abrem sem erro", async ({ page }) => {
  test.slow();
  await page.goto("/relatorios");
  const links = (await page.getByRole("main").getByRole("link").evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).getAttribute("href")!))).filter((h) => h.startsWith("/relatorios/"));
  expect(links).toHaveLength(15);
  for (const href of links) {
    const response = await page.goto(href);
    expect(response!.status(), href).toBe(200);
    await expect(page.getByRole("link", { name: "Excel" })).toBeVisible();
  }
});
