/**
 * Próteses no banco: custo da ordem vira custo de laboratório do item do
 * orçamento (inclusive quando a recepção lança), item de outro paciente é
 * recusado, conta a pagar só pela gestão e uma vez, isolamento entre clínicas.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { todayIso } from "@/lib/dates";
import { addDays } from "@/lib/timezone";
import { createTestEnv, hasSupabase, type Client } from "@/test/supabase";

describe.skipIf(!hasSupabase)("próteses e laboratórios", () => {
  const env = createTestEnv("proteses");
  const admin = env.admin;
  const today = todayIso();

  let owner: Client;
  let reception: Client;
  let other: Client;
  let clinicId = "";
  let unitId = "";
  let patientId = "";
  let otherPatient = "";
  let itemId = "";
  let labId = "";

  beforeAll(async () => {
    const ownerUser = await env.createUser("owner", "Clínica Próteses");
    await env.createUser("outra", "Clínica Outra Próteses");
    const receptionUser = await env.createUser("recepcao");
    clinicId = ownerUser.clinicId!;
    await env.addMember(clinicId, receptionUser.userId, "receptionist");
    const { data: unit } = await admin.from("units").select("id").eq("clinic_id", clinicId).single();
    unitId = unit!.id;
    const { data: pro } = await admin.from("professionals").insert({ clinic_id: clinicId, name: "Dra. Ana" }).select("id").single();
    const { data: pats } = await admin.from("patients").insert([{ clinic_id: clinicId, full_name: "Paciente Prótese" }, { clinic_id: clinicId, full_name: "Outro Paciente" }]).select("id, full_name");
    patientId = pats!.find((p) => p.full_name === "Paciente Prótese")!.id;
    otherPatient = pats!.find((p) => p.full_name === "Outro Paciente")!.id;
    owner = await env.signIn("owner");
    reception = await env.signIn("recepcao");
    other = await env.signIn("outra");

    const { data: plan } = await owner.from("treatment_plans").insert({ clinic_id: clinicId, unit_id: unitId, patient_id: patientId, professional_id: pro!.id }).select("id").single();
    const { data: item } = await owner.from("treatment_items").insert({ clinic_id: clinicId, plan_id: plan!.id, description: "Coroa", tooth: 11, faces: [], price_cents: 150000, position: 0 }).select("id").single();
    itemId = item!.id;
    const { error } = await owner.rpc("approve_treatment_plan", { _plan_id: plan!.id, _item_ids: [itemId], _discount_cents: 0, _installments: 1, _first_due_date: addDays(today, 10), _payment_method_id: null as unknown as string });
    if (error) throw error;
    const { data: lab } = await owner.from("labs").insert({ clinic_id: clinicId, name: "Lab Sorriso", phone: "11955554444" }).select("id").single();
    labId = lab!.id;
  });

  afterAll(async () => {
    await env.cleanup();
  });

  const order = (client: Client, extra: Record<string, unknown> = {}) =>
    client
      .from("prosthetic_orders")
      .insert({ clinic_id: clinicId, unit_id: unitId, patient_id: patientId, work_type: "Coroa de zircônia", teeth: [11], lab_id: labId, cost_cents: 35000, plan_item_id: itemId, ...extra })
      .select("id, stage, sent_on")
      .single();

  it("recepção não cadastra laboratório; ordem da recepção leva o custo ao item", async () => {
    expect((await reception.from("labs").insert({ clinic_id: clinicId, name: "X" })).error).not.toBeNull();
    const { data, error } = await order(reception);
    expect(error).toBeNull();
    expect((await admin.from("treatment_items").select("lab_cost_cents").eq("id", itemId).single()).data!.lab_cost_cents).toBe(35000);

    // Enviar marca a data; cancelar zera o custo do item.
    const { data: sent } = await reception.from("prosthetic_orders").update({ stage: "sent" }).eq("id", data!.id).select("sent_on").single();
    expect(sent!.sent_on).toBe(today);
    await reception.from("prosthetic_orders").update({ stage: "canceled" }).eq("id", data!.id);
    expect((await admin.from("treatment_items").select("lab_cost_cents").eq("id", itemId).single()).data!.lab_cost_cents).toBe(0);
    // Sem apagar: ordem errada fica cancelada.
    expect((await reception.from("prosthetic_orders").delete().eq("id", data!.id).select("id")).data ?? []).toEqual([]);
  });

  it("item de outro paciente é recusado", async () => {
    const { error } = await order(reception, { patient_id: otherPatient });
    expect(error?.code).toBe("OP001");
  });

  it("conta a pagar: só a gestão, uma vez, com categoria e fornecedor do laboratório", async () => {
    const { data } = await order(owner, { expected_return_on: addDays(today, 7) });
    expect((await reception.rpc("create_lab_payable", { _order_id: data!.id })).error?.code).toBe("42501");
    const { data: payableId, error } = await owner.rpc("create_lab_payable", { _order_id: data!.id });
    expect(error).toBeNull();
    const { data: bill } = await owner.from("payables").select("amount_cents, due_date, finance_categories(name), suppliers(name)").eq("id", payableId!).single();
    expect(bill).toMatchObject({ amount_cents: 35000, due_date: addDays(today, 7), finance_categories: { name: "Laboratório de prótese" }, suppliers: { name: "Lab Sorriso" } });
    expect((await owner.rpc("create_lab_payable", { _order_id: data!.id })).error?.code).toBe("OP002");
  });

  it("alinhadores exigem placas e troca; outra clínica não vê nada", async () => {
    expect((await order(reception, { kind: "aligner", plan_item_id: null })).error).not.toBeNull();
    expect((await order(reception, { kind: "aligner", plan_item_id: null, aligner_total: 20, aligner_change_days: 14 })).error).toBeNull();
    for (const t of ["labs", "lab_services", "prosthetic_orders"] as const) {
      expect((await other.from(t).select("id").eq("clinic_id", clinicId)).data).toEqual([]);
    }
  });
});
