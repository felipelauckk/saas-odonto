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
let fichaId = "";

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

  // Ficha: paciente com alerta na anamnese, dentes registrados, plano aprovado e consultas.
  const { data: owner } = await client.from("clinic_members").select("id").eq("clinic_id", user.clinicId).eq("role", "owner").single();
  await client.from("professionals").update({ member_id: owner!.id }).eq("id", professionalId);
  const { data: mariana } = await client
    .from("patients")
    .insert({ clinic_id: user.clinicId, full_name: "Mariana Costa", birth_date: "1992-03-12", phone: "51998124410", whatsapp: "51998124410", source: "indicacao" })
    .select("id")
    .single();
  fichaId = mariana!.id;
  await client.from("anamneses").insert({
    clinic_id: user.clinicId,
    patient_id: fichaId,
    answers: [
      { label: "Tem alergia a algum medicamento?", answer: "yes", alert: true, text: "penicilina" },
      { label: "Tem pressão alta?", answer: "yes", alert: true, text: "usa losartana" },
    ],
  });
  const tooth = (t: number, condition: string, faces: string[] = []) => ({ clinic_id: user.clinicId, patient_id: fichaId, tooth: t, condition, faces });
  await client.from("tooth_records").insert([
    tooth(16, "restored", ["O"]), tooth(26, "restored", ["O", "M"]), tooth(36, "caries", ["O"]), tooth(24, "caries", ["D"]),
    tooth(45, "restored", ["V"]), tooth(46, "implant"), tooth(11, "crown"), tooth(37, "root_canal"), tooth(18, "missing"), tooth(48, "missing"),
  ] as never);
  const { data: plan } = await client
    .from("treatment_plans")
    .insert({ clinic_id: user.clinicId, unit_id: unitId, patient_id: fichaId, professional_id: professionalId, status: "draft", total_cents: 438000 })
    .select("id")
    .single();
  const items = [
    ["Coroa cerâmica", 11, [], 180000],
    ["Clareamento a laser", null, [], 120000],
    ["Restauração resina", 36, ["O"], 28000],
    ["Restauração resina", 24, ["D"], 28000],
    ["Raspagem — 4 quadrantes", null, [], 82000],
  ] as const;
  const { data: rows } = await client
    .from("treatment_items")
    .insert(items.map(([description, t, faces, price], position) => ({ clinic_id: user.clinicId, plan_id: plan!.id, description, tooth: t, faces: [...faces], price_cents: price, position })))
    .select("id, position");
  await client.from("treatment_plans").update({ status: "approved", approved_at: new Date().toISOString() }).eq("id", plan!.id);
  // Só item aprovado pode virar realizado (regra do banco).
  await client.from("treatment_items").update({ status: "approved" }).eq("plan_id", plan!.id);
  for (const r of (rows ?? []).filter((r) => r.position < 2)) await client.from("treatment_items").update({ status: "done" }).eq("id", r.id);
  const inDays = (n: number, hm: string) => new Date(`${new Date(Date.now() + n * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })}T${hm}:00-03:00`).toISOString();
  await client.from("appointments").insert([
    { clinic_id: user.clinicId, unit_id: unitId, professional_id: professionalId, patient_id: fichaId, starts_at: inDays(-14, "10:00"), ends_at: inDays(-14, "11:00"), status: "done", type: "Clareamento" },
    { clinic_id: user.clinicId, unit_id: unitId, professional_id: professionalId, patient_id: fichaId, starts_at: inDays(3, "10:00"), ends_at: inDays(3, "11:00"), status: "scheduled", type: "Restauração 36" },
  ]);
  await client.from("receivables").insert({ clinic_id: user.clinicId, unit_id: unitId, patient_id: fichaId, plan_id: plan!.id, description: "Parcela 3/6", amount_cents: 73000, due_date: inDays(10, "12:00").slice(0, 10), status: "open" });
});

test.afterAll(async () => {
  await user?.cleanup();
});

for (const [name, path] of [
  ["painel", "/painel"],
  ["pacientes", "/pacientes"],
  ["agenda", "/agenda"],
  ["componentes", "/dev/componentes"],
  ["paciente", "/pacientes/{ficha}"],
  ["odontograma", "/pacientes/{ficha}/odontograma"],
] as const) {
  test(`print ${name}`, async ({ page }, info) => {
    await signIn(page, user);
    await page.goto(path.replace("{ficha}", fichaId));
    await expect(page.getByRole("main").first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    if (name === "odontograma") await page.getByRole("button", { name: /^Dente 36 inteiro/ }).click();
    await page.screenshot({ path: `${process.env.SCREENS_DIR ?? "docs/design/screens"}/${label}-${name}-${info.project.name}.png`, fullPage: true });
  });
}
