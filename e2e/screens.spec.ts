/**
 * Prints das telas para o redesign (docs/REDESIGN.md). Não roda na suíte normal:
 *   SCREENS=depois-r1 npx playwright test e2e/screens.spec.ts
 * Salva em docs/design/screens/<SCREENS>-<tela>-<projeto>.png.
 */
import { appendFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { admin, createTestUser, hasSupabase, seedAgenda, signIn, sourceIds, type TestUser } from "./support/test-user";

const label = process.env.SCREENS;
test.skip(!label || !hasSupabase, "Só com SCREENS=<rótulo>.");
test.describe.configure({ mode: "serial" });

let user: TestUser;
let fichaId = "";
let bookingSlug = "";
let leadToken = "";

test.beforeAll(async () => {
  user = await createTestUser();
  const { unitId, professionalId, patientId } = await seedAgenda(user);
  const src = await sourceIds(user);
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
  // Almoço bloqueado hoje (P2: compromissos).
  await client.from("schedule_blocks").insert({ clinic_id: user.clinicId, unit_id: unitId, professional_id: professionalId, starts_at: at("12:00"), ends_at: at("13:00"), title: "Almoço" });
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
  const { data: second } = await client.from("professionals").insert({ clinic_id: user.clinicId, name: "Dr. Marcos Silva", color: "#a3560f" }).select("id").single();
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
      professional_id: d % 4 === 0 ? (second?.id ?? professionalId) : professionalId,
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
      Array.from({ length: 6 }, (_, i) => ({ clinic_id: user.clinicId, stage_id: stage.id, name: `Contato ${i + 1}`, source_id: src.instagram, patient_id: i < 2 ? patientId : null })),
    );
  }
  const { data: stages } = await client.from("crm_stages").select("id, kind, position").eq("clinic_id", user.clinicId).order("position");
  const openStages = (stages ?? []).filter((st) => st.kind === "open");
  const won = (stages ?? []).find((st) => st.kind === "won");
  const ago = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
  const more = [
    { name: "Rodrigo Prates", source: "indicacao", interest: "Implante, perdeu um molar", stage: openStages[1], days: 1 },
    { name: "Camila Freitas", source: "instagram", interest: "Alinhadores para a filha", stage: openStages[1], days: 9 },
    { name: "Henrique Lopes", source: "site", interest: "Revisão e limpeza", stage: openStages[2], days: 2 },
    { name: "Diego Martins", source: "google", interest: "Dor no dente, pediu encaixe", stage: openStages[0], days: 0 },
    { name: "Luciana Ferreira", source: "indicacao", interest: "Implante 46", stage: won, days: 3 },
  ];
  await client.from("leads").insert(
    more.filter((m) => m.stage).map((m) => ({ clinic_id: user.clinicId, stage_id: m.stage!.id, name: m.name, source_id: src[m.source], interest: m.interest, stage_changed_at: ago(m.days) })),
  );

  // Ficha: paciente com alerta na anamnese, dentes registrados, plano aprovado e consultas.
  const { data: owner } = await client.from("clinic_members").select("id").eq("clinic_id", user.clinicId).eq("role", "owner").single();
  await client.from("professionals").update({ member_id: owner!.id }).eq("id", professionalId);
  const { data: mariana } = await client
    .from("patients")
    .insert({ clinic_id: user.clinicId, full_name: "Mariana Costa", birth_date: "1992-03-12", phone: "51998124410", whatsapp: "51998124410", source_id: src.indicacao })
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
  // Lista de pacientes: retorno vencido, orçamento apresentado, aniversariante e arquivado.
  const thisMonth = Number(day.slice(5, 7));
  const { data: others } = await client
    .from("patients")
    .insert([
      { clinic_id: user.clinicId, full_name: "Bruno Lima", birth_date: `1985-${String(thisMonth).padStart(2, "0")}-20`, phone: "51991112222", source_id: src.instagram },
      { clinic_id: user.clinicId, full_name: "Carla Souza", birth_date: "1979-07-02", phone: "51993334444", source_id: src.google },
      { clinic_id: user.clinicId, full_name: "Diego Ramos", birth_date: "2001-01-15", phone: "51995556666", source_id: src.site, archived_at: new Date().toISOString() },
    ])
    .select("id, full_name");
  // Financeiro: caixa dos últimos 6 meses, contas a pagar da semana.
  const monthsBack = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1 - (5 - i), 10, 15));
    return d.toISOString();
  });
  await client.from("cash_movements").insert(
    monthsBack.flatMap((at, i) => [
      { clinic_id: user.clinicId, unit_id: unitId, type: "in" as const, amount_cents: [7_100_000, 7_800_000, 6_900_000, 8_400_000, 8_800_000, 4_900_000][i]!, description: "Recebimentos", occurred_at: i === 5 ? new Date().toISOString() : at },
      { clinic_id: user.clinicId, unit_id: unitId, type: "out" as const, amount_cents: [5_200_000, 5_500_000, 5_800_000, 5_700_000, 6_000_000, 3_100_000][i]!, description: "Despesas", occurred_at: i === 5 ? new Date().toISOString() : at },
    ]),
  );
  const { data: category } = await client.from("finance_categories").select("id").eq("clinic_id", user.clinicId).limit(1).single();
  const { data: supplier } = await client.from("suppliers").insert({ clinic_id: user.clinicId, name: "Laboratório Dental Arte" }).select("id").single();
  if (category) {
    await client.from("payables").insert([
      { clinic_id: user.clinicId, unit_id: unitId, category_id: category.id, supplier_id: supplier?.id, description: "Coroas e facetas", amount_cents: 348000, due_date: inDays(1, "12:00").slice(0, 10) },
      { clinic_id: user.clinicId, unit_id: unitId, category_id: category.id, description: "Aluguel · unidade Centro", amount_cents: 680000, due_date: inDays(4, "12:00").slice(0, 10) },
    ]);
  }
  // Páginas públicas: agendamento online ligado e formulário de captação.
  bookingSlug = `clinica-${user.clinicId.slice(0, 8)}`;
  await client.from("online_booking_settings").upsert({ clinic_id: user.clinicId, slug: bookingSlug, enabled: true, min_notice_hours: 0, intro: "Escolha o melhor horário para a sua avaliação." });
  const { data: clinicRow } = await client.from("clinics").select("lead_form_token").eq("id", user.clinicId).single();
  leadToken = clinicRow?.lead_form_token ?? "";
  const carla = others?.find((o) => o.full_name === "Carla Souza");
  if (carla) {
    await client.from("patient_returns").insert({ clinic_id: user.clinicId, patient_id: carla.id, due_date: "2026-01-10", reason: "Manutenção semestral" });
    await client.from("treatment_plans").insert({ clinic_id: user.clinicId, unit_id: unitId, patient_id: carla.id, professional_id: professionalId, status: "presented", total_cents: 640000 });
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
  ["financeiro", "/financeiro"],
  ["financeiro-visao", "/financeiro/visao-geral"],
  ["relatorios", "/relatorios"],
  ["relatorio", "/relatorios/faturamento?agrupar=profissional"],
  ["configuracoes", "/configuracoes"],
  ["equipe", "/configuracoes/membros"],
  ["dados-clinica", "/configuracoes/clinica"],
  ["nota-fiscal", "/configuracoes/nota-fiscal"],
  ["agendamento-config", "/configuracoes/agendamento-online"],
  ["orcamento-novo", "/orcamentos/novo?paciente={ficha}"],
  ["crc", "/crc"],
  ["crm", "/crm"],
  ["agendar", "/agendar/{slug}"],
  ["captacao", "/captacao/{lead}"],
  ["paciente", "/pacientes/{ficha}"],
  ["odontograma", "/pacientes/{ficha}/odontograma"],
  ["paciente-novo", "/pacientes/novo"],
  ["paciente-editar", "/pacientes/{ficha}/editar"],
  ["config-pacientes", "/configuracoes/pacientes"],
] as const) {
  test(`print ${name}`, async ({ page }, info) => {
    await signIn(page, user);
    await page.goto(path.replace("{ficha}", fichaId).replace("{slug}", bookingSlug).replace("{lead}", leadToken));
    // Páginas públicas antigas não tinham <main>: basta o título.
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    if (name === "odontograma") await page.getByRole("button", { name: /^Dente 36 inteiro/ }).click();
    // AUDIT=<arquivo>: revisão final (R10). axe, largura no celular de 390px e alvos de toque.
    if (process.env.AUDIT) {
      if (info.project.name === "celular") {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(300);
      }
      await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
      const result = await page.evaluate(async () => {
        // @ts-expect-error axe é injetado na página
        const r = await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa"] });
        const overflow = document.documentElement.scrollWidth - window.innerWidth;
        const small = [...document.querySelectorAll("a, button, input, select, textarea, [role=button], [role=radio], [role=tab]")]
          .filter((el) => {
            const b = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            return b.width > 0 && b.height > 0 && style.visibility !== "hidden" && (b.height < 44 || b.width < 24);
          })
          .map((el) => `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40)}" ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`);
        return {
          violations: r.violations.map((v: { id: string; impact: string; nodes: { target: string[] }[] }) => ({ id: v.id, impact: v.impact, count: v.nodes.length, targets: v.nodes.slice(0, 3).map((n) => n.target.join(" ")) })),
          overflow,
          small: small.slice(0, 15),
          smallCount: small.length,
        };
      });
      appendFileSync(process.env.AUDIT, JSON.stringify({ page: name, project: info.project.name, ...result }) + "\n");
    }
    await page.screenshot({ path: `${process.env.SCREENS_DIR ?? "docs/design/screens"}/${label}-${name}-${info.project.name}.png`, fullPage: true });
  });
}

// Diálogo "Nova consulta" com a paciente da ficha (alerta na anamnese e plano aprovado).
test("print nova-consulta", async ({ page }, info) => {
  await signIn(page, user);
  await page.goto("/agenda");
  await page.getByRole("button", { name: "Nova consulta" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Paciente").first().fill("Mariana Cos");
  await dialog.getByRole("button", { name: /Mariana Costa/ }).first().click();
  // Depois da P1: profissional com expediente, para a grade de horários aparecer.
  const pro = dialog.getByLabel("Profissional", { exact: true });
  if (await pro.count()) {
    await pro.click();
    await page.getByRole("option", { name: "Dra. Ana", exact: true }).click();
  }
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${process.env.SCREENS_DIR ?? "docs/design/screens"}/${label}-nova-consulta-${info.project.name}.png` });
});

// Janela de compromisso (antes da P2: "Bloquear"; depois: "+ Novo" > "Novo compromisso").
test("print novo-compromisso", async ({ page }, info) => {
  await signIn(page, user);
  await page.goto("/agenda");
  const old = page.getByRole("button", { name: "Bloquear", exact: true });
  if (await old.count()) await old.click();
  else {
    await page.getByRole("button", { name: "Novo", exact: true }).click();
    await page.getByRole("menuitem", { name: "Novo compromisso" }).click();
  }
  await page.getByRole("dialog").waitFor();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${process.env.SCREENS_DIR ?? "docs/design/screens"}/${label}-novo-compromisso-${info.project.name}.png` });
});

// Cartão da consulta ao clicar na agenda (P3).
test("print consulta-card", async ({ page }, info) => {
  await signIn(page, user);
  await page.goto("/agenda");
  await page.getByRole("button", { name: /Paciente Agenda, 09:00/ }).first().click();
  await page.getByRole("dialog").waitFor();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${process.env.SCREENS_DIR ?? "docs/design/screens"}/${label}-consulta-card-${info.project.name}.png` });
});
