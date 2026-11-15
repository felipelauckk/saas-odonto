/**
 * Relatórios com dados reais no banco: faturamento (inclusive rateado por
 * procedimento), produção, orçamentos, primeira consulta, faltas, ocupação,
 * pacientes, sem visita, aniversariantes, inadimplência e retornos.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { todayIso } from "@/lib/dates";
import { addDays, weekdayOf } from "@/lib/timezone";
import { createTestEnv, hasSupabase, type Client } from "@/test/supabase";

import { runReportWith } from "./run";
import type { ReportFilters } from "./types";

describe.skipIf(!hasSupabase)("relatórios (dados no banco)", () => {
  const env = createTestEnv("relatorios");
  const admin = env.admin;
  const today = todayIso();
  const past = addDays(today, -10);

  let owner: Client;
  let clinicId = "";
  let unitId = "";
  let pro = "";
  let ana = "";
  let bia = "";
  let pixId = "";

  const run = (slug: string, f: Partial<ReportFilters> = {}) =>
    runReportWith(owner as never, slug, { from: addDays(today, -30), to: today, unitId: null, professionalId: null, months: 6, groupBy: "", ...f });
  const at = (day: string, time: string) => `${day}T${time}:00-03:00`;

  beforeAll(async () => {
    const ownerUser = await env.createUser("owner", "Clínica Relatórios");
    clinicId = ownerUser.clinicId!;
    const { data: unit } = await admin.from("units").select("id").eq("clinic_id", clinicId).single();
    unitId = unit!.id;
    const { data: p } = await admin.from("professionals").insert({ clinic_id: clinicId, name: "Dra. Ana" }).select("id").single();
    pro = p!.id;
    // Atende no dia da semana de "past", 08:00–12:00.
    await admin.from("professional_schedules").insert({ clinic_id: clinicId, unit_id: unitId, professional_id: pro, weekday: weekdayOf(past), start_time: "08:00", end_time: "12:00" });
    const [, m, d] = addDays(today, 5).split("-");
    const { data: pats } = await admin
      .from("patients")
      .insert([
        { clinic_id: clinicId, full_name: "Ana Relatório", source: "instagram", birth_date: `1990-${m}-${d}`, address: { city: "Campinas", state: "SP", district: "Centro" } },
        { clinic_id: clinicId, full_name: "Bia Relatório", source: "google", birth_date: "2015-01-01", address: { city: "Campinas", state: "SP", district: "Cambuí" } },
      ])
      .select("id, full_name");
    ana = pats!.find((x) => x.full_name.startsWith("Ana"))!.id;
    bia = pats!.find((x) => x.full_name.startsWith("Bia"))!.id;
    owner = await env.signIn("owner");
    const { data: methods } = await owner.from("payment_methods").select("id, name");
    pixId = methods!.find((x) => x.name === "Pix")!.id;

    // Ana: primeira consulta atendida (09:00–10:00), orçamento aprovado com 2 itens, 1 parcela paga e 1 vencida.
    const { data: a1 } = await admin.from("appointments").insert({ clinic_id: clinicId, unit_id: unitId, patient_id: ana, professional_id: pro, starts_at: at(past, "09:00"), ends_at: at(past, "10:00") }).select("id").single();
    await admin.from("appointments").update({ status: "done" }).eq("id", a1!.id);
    // Bia: primeira consulta com falta (10:00–11:00).
    const { data: a2 } = await admin.from("appointments").insert({ clinic_id: clinicId, unit_id: unitId, patient_id: bia, professional_id: pro, starts_at: at(past, "10:00"), ends_at: at(past, "11:00") }).select("id").single();
    await admin.from("appointments").update({ status: "no_show" }).eq("id", a2!.id);

    const { data: plan } = await owner.from("treatment_plans").insert({ clinic_id: clinicId, unit_id: unitId, patient_id: ana, professional_id: pro }).select("id").single();
    const { data: items } = await owner
      .from("treatment_items")
      .insert([
        { clinic_id: clinicId, plan_id: plan!.id, description: "Restauração", faces: [], price_cents: 30000, position: 0 },
        { clinic_id: clinicId, plan_id: plan!.id, description: "Limpeza", faces: [], price_cents: 10000, position: 1 },
      ])
      .select("id, description");
    const { error: approveError } = await owner.rpc("approve_treatment_plan", {
      _plan_id: plan!.id, _item_ids: items!.map((i) => i.id), _discount_cents: 0, _installments: 2, _first_due_date: addDays(today, -40), _payment_method_id: null as unknown as string,
    });
    if (approveError) throw approveError;
    const { data: recs } = await owner.from("receivables").select("id, installment_number").eq("plan_id", plan!.id).order("installment_number");
    const { error: payError } = await owner.rpc("receive_payment", { _receivable_id: recs![0]!.id, _paid_amount_cents: 20000, _payment_method_id: pixId, _paid_on: today });
    if (payError) throw payError;
    // Segunda parcela: vence há 10 dias.
    await admin.from("receivables").update({ due_date: past }).eq("id", recs![1]!.id);
    await admin.from("treatment_items").update({ status: "done", done_at: new Date().toISOString() }).eq("id", items!.find((i) => i.description === "Limpeza")!.id);

    await admin.from("patient_returns").insert([
      { clinic_id: clinicId, patient_id: ana, professional_id: pro, reason: "Limpeza", due_date: addDays(today, -2), status: "pending" },
      { clinic_id: clinicId, patient_id: bia, professional_id: pro, reason: "Avaliação", due_date: addDays(today, -1), status: "dismissed" },
    ]);
  });

  afterAll(async () => {
    await env.cleanup();
  });

  it("faturamento por mês e rateado por procedimento", async () => {
    const byMonth = await run("faturamento", { groupBy: "mes" });
    expect(byMonth!.total).toMatchObject({ count: 1, gross: 20000 });
    const byProcedure = await run("faturamento", { groupBy: "procedimento" });
    const map = Object.fromEntries(byProcedure!.rows.map((r) => [r.group, r.gross]));
    expect(map).toEqual({ Restauração: 15000, Limpeza: 5000 });
    const byMethod = await run("faturamento", { groupBy: "forma" });
    expect(byMethod!.rows[0]!.group).toBe("Pix");
  });

  it("produção, orçamentos e primeira consulta", async () => {
    expect((await run("producao", { groupBy: "procedimento" }))!.rows).toEqual([{ group: "Limpeza", count: 1, value: 10000 }]);
    expect((await run("orcamentos"))!.total).toMatchObject({ issued: 1, approved: 1, conversion: 1, ticket: 40000 });
    const first = await run("primeira-consulta");
    expect(first!.total).toMatchObject({ total: 2, attended: 1, noShow: 1, treatment: 1, conversion: 1 });
  });

  it("faltas e ocupação da agenda", async () => {
    expect((await run("faltas"))!.total).toMatchObject({ past: 2, noShow: 1, rate: 0.5 });
    const occupancy = await run("ocupacao", { groupBy: "profissional", from: past, to: past });
    // 4 h disponíveis, 2 h reservadas (inclui a falta).
    expect(occupancy!.rows).toEqual([{ group: "Dra. Ana", available: 4, occupied: 2, rate: 0.5 }]);
  });

  it("pacientes por cidade e idade; aniversariantes", async () => {
    expect((await run("pacientes", { groupBy: "cidade" }))!.rows).toEqual([{ group: "Campinas/SP", count: 2, share: 1 }]);
    const ages = await run("pacientes", { groupBy: "idade" });
    expect(ages!.rows.map((r) => r.group)).toEqual(["0 a 12", "30 a 44"]);
    const bdays = await run("aniversariantes", { from: today, to: addDays(today, 10) });
    expect(bdays!.rows.map((r) => r.group)).toEqual(["Ana Relatório"]);
  });

  it("inadimplência por idade da dívida e retornos", async () => {
    const debt = await run("inadimplencia");
    expect(debt!.rows).toHaveLength(1);
    expect(debt!.rows[0]).toMatchObject({ group: "Ana Relatório", d30: 20000, total: 20000 });
    const returns = await run("retornos");
    expect(returns!.total).toMatchObject({ total: 2, overdue: 1, dismissed: 1, kept: 0 });
  });

  it("sem visita: ninguém com visita antiga", async () => {
    expect((await run("sem-visita", { months: 6 }))!.rows).toEqual([]);
    expect((await run("sem-visita", { months: 1 }))!.rows).toEqual([]);
  });
});
