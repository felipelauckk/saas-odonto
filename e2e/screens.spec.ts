/**
 * Prints das telas para o redesign (docs/REDESIGN.md). Não roda na suíte normal:
 *   SCREENS=depois-r1 npx playwright test e2e/screens.spec.ts
 * Salva em docs/design/screens/<SCREENS>-<tela>-<projeto>.png.
 */
import { expect, test } from "@playwright/test";

import { admin, createTestUser, hasSupabase, seedAgenda, signIn, type TestUser } from "./support/test-user";

const label = process.env.SCREENS;
test.skip(!label || !hasSupabase, "Só com SCREENS=<rótulo>.");
test.describe.configure({ mode: "serial" });

let user: TestUser;

test.beforeAll(async () => {
  user = await createTestUser();
  const { unitId, professionalId, patientId } = await seedAgenda(user);
  const client = admin();
  await client.from("patients").insert([
    { clinic_id: user.clinicId, full_name: "Marina Alves", phone: "11977776666" },
    { clinic_id: user.clinicId, full_name: "João Pereira", phone: "11966665555" },
  ]);
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const at = (h: string) => new Date(`${day}T${h}:00-03:00`).toISOString();
  await client.from("appointments").insert([
    { clinic_id: user.clinicId, unit_id: unitId, professional_id: professionalId, patient_id: patientId, starts_at: at("09:00"), ends_at: at("10:00"), status: "confirmed" },
    { clinic_id: user.clinicId, unit_id: unitId, professional_id: professionalId, patient_id: patientId, starts_at: at("14:00"), ends_at: at("14:30"), status: "scheduled" },
  ]);
});

test.afterAll(async () => {
  await user?.cleanup();
});

for (const [name, path] of [
  ["painel", "/painel"],
  ["pacientes", "/pacientes"],
  ["agenda", "/agenda"],
  ["componentes", "/dev/componentes"],
] as const) {
  test(`print ${name}`, async ({ page }, info) => {
    await signIn(page, user);
    await page.goto(path);
    await expect(page.getByRole("main").first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `${process.env.SCREENS_DIR ?? "docs/design/screens"}/${label}-${name}-${info.project.name}.png`, fullPage: true });
  });
}
