/**
 * Estoque no banco: entrada por lote, saída pelo lote que vence antes (FEFO),
 * saldo insuficiente recusado, transferência entre unidades, baixa do kit ao
 * realizar o procedimento, permissões e relatório de consumo.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runReportWith } from "@/features/reports/run";
import { todayIso } from "@/lib/dates";
import { addDays } from "@/lib/timezone";
import { createTestEnv, hasSupabase, type Client } from "@/test/supabase";

describe.skipIf(!hasSupabase)("estoque", () => {
  const env = createTestEnv("estoque");
  const admin = env.admin;
  const today = todayIso();

  let owner: Client;
  let reception: Client;
  let dentist: Client;
  let other: Client;
  let clinicId = "";
  let unitA = "";
  let unitB = "";
  let resin = "";
  let gloves = "";
  let procedureId = "";
  let pro = "";
  let patientId = "";

  const lotsOf = async (unit: string, product: string) =>
    ((await admin.from("stock_lots").select("lot_code, qty, expires_on").eq("unit_id", unit).eq("product_id", product).order("expires_on")).data ?? []).map((l) => [l.lot_code, Number(l.qty)]);
  const purchase = (client: Client, unit: string, product: string, qty: number, lot: string | null, expires: string | null, cost = 1000, payable = false) =>
    client.rpc("stock_purchase", { _unit_id: unit, _product_id: product, _qty: qty, _unit_cost_cents: cost, _lot_code: lot as string, _expires_on: expires as string, _supplier_id: null as unknown as string, _create_payable: payable, _due_date: null as unknown as string });

  beforeAll(async () => {
    const ownerUser = await env.createUser("owner", "Clínica Estoque");
    await env.createUser("outra", "Clínica Outra Estoque");
    const receptionUser = await env.createUser("recepcao");
    const dentistUser = await env.createUser("dentista");
    clinicId = ownerUser.clinicId!;
    await env.addMember(clinicId, receptionUser.userId, "receptionist");
    await env.addMember(clinicId, dentistUser.userId, "dentist");
    const { data: unit } = await admin.from("units").select("id").eq("clinic_id", clinicId).single();
    unitA = unit!.id;
    const { data: b } = await admin.from("units").insert({ clinic_id: clinicId, name: "Unidade B" }).select("id").single();
    unitB = b!.id;
    const { data: p } = await admin.from("professionals").insert({ clinic_id: clinicId, name: "Dra. Ana" }).select("id").single();
    pro = p!.id;
    const { data: pat } = await admin.from("patients").insert({ clinic_id: clinicId, full_name: "Paciente Estoque" }).select("id").single();
    patientId = pat!.id;
    const { data: proc } = await admin.from("procedures").insert({ clinic_id: clinicId, name: "Restauração teste", price_cents: 20000, duration_min: 30 }).select("id").single();
    procedureId = proc!.id;
    owner = await env.signIn("owner");
    reception = await env.signIn("recepcao");
    dentist = await env.signIn("dentista");
    other = await env.signIn("outra");
    const { data: prods } = await reception.from("stock_products").insert([
      { clinic_id: clinicId, name: "Resina A2", measure: "un", min_qty: 2 },
      { clinic_id: clinicId, name: "Luva", measure: "cx", min_qty: 1 },
    ]).select("id, name");
    resin = prods!.find((x) => x.name === "Resina A2")!.id;
    gloves = prods!.find((x) => x.name === "Luva")!.id;
  });

  afterAll(async () => {
    await env.cleanup();
  });

  it("entrada por lote; saída tira primeiro o que vence antes; sem saldo é recusado", async () => {
    expect((await purchase(reception, unitA, resin, 3, "L-TARDE", addDays(today, 300))).error).toBeNull();
    expect((await purchase(reception, unitA, resin, 2, "L-CEDO", addDays(today, 30))).error).toBeNull();
    expect((await reception.rpc("stock_out", { _unit_id: unitA, _product_id: resin, _qty: 3, _note: "uso" })).error).toBeNull();
    expect(await lotsOf(unitA, resin)).toEqual([["L-CEDO", 0], ["L-TARDE", 2]]);
    expect((await reception.rpc("stock_out", { _unit_id: unitA, _product_id: resin, _qty: 5, _note: "" })).error?.code).toBe("OE001");
    expect(await lotsOf(unitA, resin)).toEqual([["L-CEDO", 0], ["L-TARDE", 2]]);
  });

  it("transfere entre unidades mantendo lote e validade", async () => {
    expect((await reception.rpc("stock_transfer", { _from_unit: unitA, _to_unit: unitB, _product_id: resin, _qty: 1.5 })).error).toBeNull();
    expect(await lotsOf(unitB, resin)).toEqual([["L-TARDE", 1.5]]);
    expect((await lotsOf(unitA, resin)).at(-1)).toEqual(["L-TARDE", 0.5]);
  });

  it("dentista não movimenta; recepção não lança conta a pagar; gestão lança", async () => {
    expect((await dentist.rpc("stock_out", { _unit_id: unitA, _product_id: resin, _qty: 0.1, _note: "" })).error?.code).toBe("42501");
    expect((await purchase(reception, unitA, gloves, 2, null, null, 5000, true)).error?.code).toBe("42501");
    expect((await purchase(owner, unitA, gloves, 2, null, null, 5000, true)).error).toBeNull();
    const { data: bills } = await owner.from("payables").select("amount_cents, finance_categories(name)").eq("description", "Compra: Luva");
    expect(bills).toEqual([{ amount_cents: 10000, finance_categories: { name: "Material odontológico" } }]);
    // Lotes e movimentos não se editam pelo app.
    expect((await owner.from("stock_lots").update({ qty: 999 } as never).eq("product_id", gloves)).error).not.toBeNull();
    expect((await other.from("stock_products").select("id").eq("clinic_id", clinicId)).data).toEqual([]);
  });

  it("procedimento realizado baixa o kit (e registra a falta); relatório de consumo", async () => {
    expect((await reception.from("procedure_kits").insert({ clinic_id: clinicId, procedure_id: procedureId, product_id: gloves, qty: 1 })).error).not.toBeNull();
    await owner.from("procedure_kits").insert([
      { clinic_id: clinicId, procedure_id: procedureId, product_id: gloves, qty: 1 },
      { clinic_id: clinicId, procedure_id: procedureId, product_id: resin, qty: 1 },
    ]);
    const { data: plan } = await owner.from("treatment_plans").insert({ clinic_id: clinicId, unit_id: unitA, patient_id: patientId, professional_id: pro }).select("id").single();
    const { data: item } = await owner.from("treatment_items").insert({ clinic_id: clinicId, plan_id: plan!.id, procedure_id: procedureId, description: "Restauração", faces: [], price_cents: 20000, position: 0 }).select("id").single();
    await owner.rpc("approve_treatment_plan", { _plan_id: plan!.id, _item_ids: [item!.id], _discount_cents: 0, _installments: 1, _first_due_date: addDays(today, 10), _payment_method_id: null as unknown as string });
    expect((await owner.from("treatment_items").update({ status: "done" }).eq("id", item!.id)).error).toBeNull();

    expect(await lotsOf(unitA, gloves)).toEqual([[null, 1]]);
    const { data: moves } = await admin.from("stock_movements").select("product_id, qty, shortage").eq("treatment_item_id", item!.id).order("qty");
    // Resina: tinha 0,5 na unidade A; faltou 0,5.
    expect(moves!.map((m) => [m.product_id === gloves ? "luva" : "resina", Number(m.qty), Number(m.shortage)]).sort()).toEqual([["luva", -1, 0], ["resina", -0.5, 0], ["resina", -0.5, 0.5]]);

    const report = await runReportWith(owner as never, "consumo", { from: today, to: today, unitId: unitA, professionalId: null, months: 6, groupBy: "procedimento" });
    const row = report!.rows.find((r) => r.group === "Restauração teste");
    // Luva 1 × R$ 50,00 + resina 0,5 × R$ 10,00 (a falta não tem custo).
    expect(row).toMatchObject({ procedures: 1, cost: 5500, perProcedure: 5500 });
  });
});
