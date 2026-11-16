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
    { clinic_id: user.clinicId, unit_id: unitId, professional_id: professionalId, patient_id: patientId, starts_at: at("08:00"), ends_at: at("08:45"), status: "done", type: "Limpeza" },
    { clinic_id: user.clinicId, unit_id: unitId, professional_id: professionalId, patient_id: patientId, starts_at: at("10:30"), ends_at: at("11:30"), status: "in_progress", type: "Restauração 36" },
    { clinic_id: user.clinicId, unit_id: unitId, professional_id: professionalId, patient_id: patientId, starts_at: at("11:30"), ends_at: at("12:00"), status: "arrived", arrived_at: new Date(Date.now() - 18 * 60_000).toISOString(), is_first_visit: true, type: "Avaliação" },
    { clinic_id: user.clinicId, unit_id: unitId, professional_id: professionalId, patient_id: patientId, starts_at: at("15:00"), ends_at: at("15:30"), status: "no_show" },
    { clinic_id: user.clinicId, unit_id: unitId, professional_id: professionalId, patient_id: patientId, starts_at: at("16:00"), ends_at: at("17:00"), status: "confirmed", type: "Clareamento" },
  ]);
  // Vaga liberada: consulta desmarcada daqui a 2 dias e alguém na lista de espera.
  const later = new Date(Date.now() + 2 * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  await client.from("appointments").insert({
    clinic_id: user.clinicId, unit_id: unitId, professional_id: professionalId, patient_id: patientId,
    starts_at: new Date(`${later}T09:00:00-03:00`).toISOString(), ends_at: new Date(`${later}T10:00:00-03:00`).toISOString(), status: "canceled", cancel_reason: "patient_canceled",
  });
  const { data: waiting } = await client.from("patients").select("id").eq("clinic_id", user.clinicId).eq("full_name", "Marina Alves").single();
  if (waiting) await client.from("waitlist").insert({ clinic_id: user.clinicId, unit_id: unitId, patient_id: waiting.id, notes: "Prefere manhãs" });

  // Painel: recebimentos do mês, meta, orçamento apresentado e leads.
  const month = day.slice(0, 7);
  const today = Number(day.slice(8, 10));
  const paid = Array.from({ length: today }, (_, i) => i + 1)
    .filter((d) => d % 3 !== 0)
    .map((d) => ({
      clinic_id: user.clinicId,
      unit_id: unitId,
      patient_id: patientId,
      description: "Tratamento",
      amount_cents: 150000 + (d % 5) * 40000,
      due_date: `${month}-${String(d).padStart(2, "0")}`,
      status: "paid" as const,
      paid_at: `${month}-${String(d).padStart(2, "0")}T12:00:00-03:00`,
      paid_amount_cents: 150000 + (d % 5) * 40000,
    }));
  await client.from("receivables").insert([
    ...paid,
    { clinic_id: user.clinicId, unit_id: unitId, patient_id: patientId, description: "Parcela", amount_cents: 318000, due_date: "2020-01-10", status: "overdue" },
  ]);
  await client.from("goals").insert({ clinic_id: user.clinicId, month: `${month}-01`, metric: "revenue", target: 5_000_000 });
  await client.from("treatment_plans").insert({ clinic_id: user.clinicId, unit_id: unitId, patient_id: patientId, professional_id: professionalId, status: "presented", total_cents: 820000 });
  const { data: stage } = await client.from("crm_stages").select("id").eq("clinic_id", user.clinicId).eq("auto_key", "new").single();
  if (stage) {
    await client.from("leads").insert(
      Array.from({ length: 6 }, (_, i) => ({ clinic_id: user.clinicId, stage_id: stage.id, name: `Contato ${i + 1}`, source: "instagram" as const, patient_id: i < 2 ? patientId : null })),
    );
  }
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
