/**
 * Financeiro no banco: baixa com taxa e entrada no caixa, estorno, cancelamento,
 * vencidos automáticos e quem pode operar.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { todayIso } from "@/lib/dates";
import { addDays } from "@/lib/timezone";
import { createTestEnv, hasSupabase, type Client } from "@/test/supabase";

describe.skipIf(!hasSupabase)("financeiro (RLS e baixa)", () => {
  const env = createTestEnv("financeiro");
  const admin = env.admin;
  const today = todayIso();

  let owner: Client;
  let dentist: Client;
  let reception: Client;
  let other: Client;
  let clinicId = "";
  let unitId = "";
  let patientId = "";
  let creditId = "";
  let receivableId = "";

  beforeAll(async () => {
    const ownerUser = await env.createUser("owner", "Clínica Financeiro");
    await env.createUser("outra", "Clínica Outra Financeiro");
    const dentistUser = await env.createUser("dentista");
    const receptionUser = await env.createUser("recepcao");
    clinicId = ownerUser.clinicId!;
    await env.addMember(clinicId, dentistUser.userId, "dentist");
    await env.addMember(clinicId, receptionUser.userId, "receptionist");

    const { data: unit } = await admin.from("units").select("id").eq("clinic_id", clinicId).single();
    unitId = unit!.id;
    const { data: patient } = await admin.from("patients").insert({ clinic_id: clinicId, full_name: "Paciente Financeiro" }).select("id").single();
    patientId = patient!.id;
    const { data: credit } = await admin
      .from("payment_methods")
      .update({ fee_percent: 3.5 })
      .eq("clinic_id", clinicId)
      .eq("name", "Cartão de crédito")
      .select("id")
      .single();
    creditId = credit!.id;

    owner = await env.signIn("owner");
    dentist = await env.signIn("dentista");
    reception = await env.signIn("recepcao");
    other = await env.signIn("outra");
  });

  afterAll(async () => {
    await env.cleanup();
  });

  it("recepção lança conta avulsa; vencimento no passado já nasce vencido", async () => {
    const { data, error } = await reception
      .from("receivables")
      .insert({ clinic_id: clinicId, unit_id: unitId, patient_id: patientId, description: "Consulta avulsa", amount_cents: 20000, due_date: today })
      .select("id, status")
      .single();
    expect(error).toBeNull();
    expect(data?.status).toBe("open");
    receivableId = data!.id;

    const { data: late } = await reception
      .from("receivables")
      .insert({ clinic_id: clinicId, unit_id: unitId, patient_id: patientId, description: "Atrasada", amount_cents: 5000, due_date: addDays(today, -3) })
      .select("status")
      .single();
    expect(late?.status).toBe("overdue");
  });

  it("dentista não lança conta nem recebe", async () => {
    const { error } = await dentist
      .from("receivables")
      .insert({ clinic_id: clinicId, unit_id: unitId, patient_id: patientId, description: "X", amount_cents: 100, due_date: today });
    expect(error).not.toBeNull();

    const { error: receive } = await dentist.rpc("receive_payment", {
      _receivable_id: receivableId,
      _paid_amount_cents: 20000,
      _payment_method_id: creditId,
      _paid_on: today,
    });
    expect(receive?.code).toBe("42501");
  });

  it("baixa calcula a taxa e lança a entrada no caixa", async () => {
    const { error } = await reception.rpc("receive_payment", {
      _receivable_id: receivableId,
      _paid_amount_cents: 20000,
      _payment_method_id: creditId,
      _paid_on: today,
    });
    expect(error).toBeNull();

    const { data: r } = await reception.from("receivables").select("status, paid_amount_cents, fee_cents").eq("id", receivableId).single();
    expect(r).toEqual({ status: "paid", paid_amount_cents: 20000, fee_cents: 700 });

    const { data: cash } = await reception.from("cash_movements").select("type, amount_cents").eq("receivable_id", receivableId);
    expect(cash).toEqual([{ type: "in", amount_cents: 20000 }]);

    const { error: twice } = await reception.rpc("receive_payment", {
      _receivable_id: receivableId,
      _paid_amount_cents: 20000,
      _payment_method_id: creditId,
      _paid_on: today,
    });
    expect(twice?.code).toBe("OF001");
  });

  it("pagamento no futuro é recusado", async () => {
    const { data } = await reception
      .from("receivables")
      .insert({ clinic_id: clinicId, unit_id: unitId, patient_id: patientId, description: "Futuro", amount_cents: 1000, due_date: today })
      .select("id")
      .single();
    const { error } = await reception.rpc("receive_payment", {
      _receivable_id: data!.id,
      _paid_amount_cents: 1000,
      _payment_method_id: creditId,
      _paid_on: addDays(today, 1),
    });
    expect(error?.code).toBe("OF003");
  });

  it("só a gestão estorna e cancela", async () => {
    const { error: receptionReverse } = await reception.rpc("reverse_payment", { _receivable_id: receivableId });
    expect(receptionReverse?.code).toBe("42501");

    const { error } = await owner.rpc("reverse_payment", { _receivable_id: receivableId });
    expect(error).toBeNull();
    const { data: r } = await owner.from("receivables").select("status, paid_at").eq("id", receivableId).single();
    expect(r).toEqual({ status: "open", paid_at: null });
    const { data: cash } = await owner.from("cash_movements").select("type").eq("receivable_id", receivableId).order("created_at");
    expect(cash?.map((c) => c.type)).toEqual(["in", "out"]);

    const { error: cancel } = await owner.rpc("cancel_receivable", { _receivable_id: receivableId });
    expect(cancel).toBeNull();
  });

  it("caixa: recepção lança e lê; dentista e outra clínica não veem", async () => {
    const { error } = await reception
      .from("cash_movements")
      .insert({ clinic_id: clinicId, unit_id: unitId, type: "out", amount_cents: 3000, description: "Material de limpeza" });
    expect(error).toBeNull();

    const { error: edit } = await reception.from("cash_movements").update({ amount_cents: 1 }).eq("clinic_id", clinicId);
    expect(edit).not.toBeNull();

    const { data: dentistCash } = await dentist.from("cash_movements").select("id");
    expect(dentistCash).toEqual([]);
    const { data: otherCash } = await other.from("cash_movements").select("id");
    expect(otherCash).toEqual([]);
    const { data: otherReceivables } = await other.from("receivables").select("id");
    expect(otherReceivables).toEqual([]);
  });
});
