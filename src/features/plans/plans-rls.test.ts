/**
 * Orçamentos no banco: total por gatilho, aprovação parcial gerando parcelas,
 * trava de itens depois da aprovação, conclusão automática e quem vê os recebíveis.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestEnv, hasSupabase, type Client } from "@/test/supabase";

describe.skipIf(!hasSupabase)("orçamentos (RLS e aprovação)", () => {
  const env = createTestEnv("orcamentos");
  const admin = env.admin;

  let owner: Client;
  let dentist: Client;
  let reception: Client;
  let other: Client;
  let clinicId = "";
  let unitId = "";
  let patientId = "";
  let drAna = "";
  let drBeto = "";
  let planId = "";
  let itemIds: string[] = [];

  beforeAll(async () => {
    const ownerUser = await env.createUser("owner", "Clínica Orçamentos");
    await env.createUser("outra", "Clínica Outra Orçamentos");
    const dentistUser = await env.createUser("dentista");
    const receptionUser = await env.createUser("recepcao");
    clinicId = ownerUser.clinicId!;
    const dentistMember = await env.addMember(clinicId, dentistUser.userId, "dentist");
    await env.addMember(clinicId, receptionUser.userId, "receptionist");

    const { data: unit } = await admin.from("units").select("id").eq("clinic_id", clinicId).single();
    unitId = unit!.id;
    const { data: pros } = await admin
      .from("professionals")
      .insert([
        { clinic_id: clinicId, name: "Dra. Ana", member_id: dentistMember },
        { clinic_id: clinicId, name: "Dr. Beto" },
      ])
      .select("id, name");
    drAna = pros!.find((p) => p.name === "Dra. Ana")!.id;
    drBeto = pros!.find((p) => p.name === "Dr. Beto")!.id;
    const { data: patient } = await admin.from("patients").insert({ clinic_id: clinicId, full_name: "Paciente Orçamento" }).select("id").single();
    patientId = patient!.id;

    owner = await env.signIn("owner");
    dentist = await env.signIn("dentista");
    reception = await env.signIn("recepcao");
    other = await env.signIn("outra");
  });

  afterAll(async () => {
    await env.cleanup();
  });

  it("recepção monta o orçamento e o total é a soma dos itens", async () => {
    const { data: plan, error } = await reception
      .from("treatment_plans")
      .insert({ clinic_id: clinicId, unit_id: unitId, patient_id: patientId, professional_id: drAna })
      .select("id")
      .single();
    expect(error).toBeNull();
    planId = plan!.id;

    const { data: items, error: itemsError } = await reception
      .from("treatment_items")
      .insert([
        { clinic_id: clinicId, plan_id: planId, description: "Restauração", tooth: 16, faces: ["O"], price_cents: 25000, position: 0 },
        { clinic_id: clinicId, plan_id: planId, description: "Canal", tooth: 36, faces: [], price_cents: 90001, position: 1 },
        { clinic_id: clinicId, plan_id: planId, description: "Clareamento", tooth: null, faces: [], price_cents: 60000, position: 2 },
      ])
      .select("id");
    expect(itemsError).toBeNull();
    itemIds = items!.map((i) => i.id);

    const { data: check } = await reception.from("treatment_plans").select("total_cents").eq("id", planId).single();
    expect(check?.total_cents).toBe(175001);
  });

  it("aprovação parcial gera parcelas com os centavos na primeira", async () => {
    const { error } = await reception.rpc("approve_treatment_plan", {
      _plan_id: planId,
      _item_ids: [itemIds[0]!, itemIds[1]!],
      _discount_cents: 1,
      _installments: 3,
      _first_due_date: "2030-01-31",
      _payment_method_id: null as unknown as string,
    });
    expect(error).toBeNull();

    const { data: plan } = await reception.from("treatment_plans").select("status, total_cents, discount_cents").eq("id", planId).single();
    expect(plan).toEqual({ status: "partially_approved", total_cents: 115001, discount_cents: 1 });

    const { data: receivables } = await reception
      .from("receivables")
      .select("amount_cents, due_date, installment_number, installment_total, professional_id")
      .eq("plan_id", planId)
      .order("installment_number");
    expect(receivables?.map((r) => r.amount_cents)).toEqual([38334, 38333, 38333]);
    expect(receivables!.reduce((s, r) => s + r.amount_cents, 0)).toBe(115000);
    // Fim do mês: 31/01 → 28/02 → 31/03.
    expect(receivables?.map((r) => r.due_date)).toEqual(["2030-01-31", "2030-02-28", "2030-03-31"]);
    expect(receivables?.every((r) => r.professional_id === drAna)).toBe(true);
  });

  it("depois de aprovado, itens não mudam e não se aprova de novo", async () => {
    const { error: price } = await owner.from("treatment_items").update({ price_cents: 1 }).eq("id", itemIds[0]!);
    expect(price?.code).toBe("OT001");

    const { error: remove } = await owner.from("treatment_items").delete().eq("id", itemIds[0]!);
    expect(remove?.code).toBe("OT001");

    const { error: again } = await owner.rpc("approve_treatment_plan", {
      _plan_id: planId,
      _item_ids: itemIds,
      _discount_cents: 0,
      _installments: 1,
      _first_due_date: "2030-01-31",
      _payment_method_id: null as unknown as string,
    });
    expect(again?.code).toBe("OT003");
  });

  it("recepção não marca realizado; dentista marca e o plano conclui", async () => {
    const { error: reception1 } = await reception.from("treatment_items").update({ status: "done" }).eq("id", itemIds[0]!);
    expect(reception1).not.toBeNull();

    const { error: rejectedDone } = await dentist.from("treatment_items").update({ status: "done" }).eq("id", itemIds[2]!);
    expect(rejectedDone?.code).toBe("OT002");

    for (const id of itemIds.slice(0, 2)) {
      const { error } = await dentist.from("treatment_items").update({ status: "done" }).eq("id", id);
      expect(error).toBeNull();
    }
    const { data: plan } = await owner.from("treatment_plans").select("status").eq("id", planId).single();
    expect(plan?.status).toBe("completed");

    const { data: item } = await owner.from("treatment_items").select("done_at, done_by").eq("id", itemIds[0]!).single();
    expect(item?.done_at).not.toBeNull();
  });

  it("dentista vê só os próprios recebíveis; outra clínica não vê nada", async () => {
    await admin.from("receivables").insert({
      clinic_id: clinicId,
      unit_id: unitId,
      patient_id: patientId,
      professional_id: drBeto,
      description: "Do Dr. Beto",
      amount_cents: 1000,
      due_date: "2030-01-10",
    });

    const { data: mine } = await dentist.from("receivables").select("professional_id");
    expect(mine!.length).toBe(3);
    expect(mine!.every((r) => r.professional_id === drAna)).toBe(true);

    const { data: all } = await reception.from("receivables").select("id");
    expect(all!.length).toBe(4);

    for (const table of ["treatment_plans", "treatment_items", "receivables"] as const) {
      const { data } = await other.from(table).select("id");
      expect(data).toEqual([]);
    }
  });

  it("parcela de orçamento só nasce pela aprovação; dentista não lança cobrança", async () => {
    const { error } = await owner.from("receivables").insert({
      clinic_id: clinicId,
      unit_id: unitId,
      patient_id: patientId,
      plan_id: planId,
      description: "Parcela forjada",
      amount_cents: 100,
      due_date: "2030-01-10",
    } as never);
    expect(error).not.toBeNull();

    const { error: dentistError } = await dentist.from("receivables").insert({
      clinic_id: clinicId,
      unit_id: unitId,
      patient_id: patientId,
      description: "Avulsa",
      amount_cents: 100,
      due_date: "2030-01-10",
    });
    expect(dentistError).not.toBeNull();

    const { data: draft } = await owner
      .from("treatment_plans")
      .insert({ clinic_id: clinicId, unit_id: unitId, patient_id: patientId, professional_id: drAna })
      .select("id")
      .single();
    const { error: approveByUpdate } = await owner.from("treatment_plans").update({ status: "approved" }).eq("id", draft!.id);
    expect(approveByUpdate).not.toBeNull();
  });
});
