/**
 * Fase 3, P7 no banco: crédito do paciente (saldo nunca negativo, só por
 * funções, estorno devolve) e mensalidades (uma parcela por mês, encerrar não
 * apaga o que já foi gerado).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { todayIso } from "@/lib/dates";
import { addDays } from "@/lib/timezone";
import { createTestEnv, hasSupabase, type Client } from "@/test/supabase";

describe.skipIf(!hasSupabase)("crédito e mensalidades (P7)", () => {
  const env = createTestEnv("credito-p7");
  const admin = env.admin;
  const today = todayIso();

  let owner: Client;
  let dentist: Client;
  let reception: Client;
  let other: Client;
  let clinicId = "";
  let unitId = "";
  let patientId = "";
  let pix = "";

  const balance = async (c: Client = reception) => (await c.rpc("patient_credit_balance", { _patient_id: patientId })).data;
  const newReceivable = async (cents: number) =>
    (
      await admin
        .from("receivables")
        .insert({ clinic_id: clinicId, unit_id: unitId, patient_id: patientId, description: "Parcela", amount_cents: cents, due_date: addDays(today, 5) })
        .select("id")
        .single()
    ).data!.id;

  beforeAll(async () => {
    const ownerUser = await env.createUser("owner", "Clínica Crédito");
    await env.createUser("outra", "Clínica Outra Crédito");
    const dentistUser = await env.createUser("dentista");
    const receptionUser = await env.createUser("recepcao");
    clinicId = ownerUser.clinicId!;
    await env.addMember(clinicId, dentistUser.userId, "dentist");
    await env.addMember(clinicId, receptionUser.userId, "receptionist");
    const { data: unit } = await admin.from("units").select("id").eq("clinic_id", clinicId).single();
    unitId = unit!.id;
    const { data: patient } = await admin.from("patients").insert({ clinic_id: clinicId, full_name: "Paciente Crédito" }).select("id").single();
    patientId = patient!.id;
    const { data: method } = await admin.from("payment_methods").select("id").eq("clinic_id", clinicId).eq("name", "Pix").single();
    pix = method!.id;
    owner = await env.signIn("owner");
    dentist = await env.signIn("dentista");
    reception = await env.signIn("recepcao");
    other = await env.signIn("outra");
  });

  afterAll(async () => {
    await env.cleanup();
  });

  it("pagamento a mais vira crédito; usar crédito paga a parcela sem caixa; saldo nunca negativo; estorno devolve", async () => {
    const r1 = await newReceivable(10000);
    expect((await reception.rpc("receive_payment_with_credit", { _receivable_id: r1, _paid_amount_cents: 15000, _payment_method_id: pix, _paid_on: today })).error).toBeNull();
    expect(await balance()).toBe(5000);

    // Ninguém grava crédito direto na tabela; dentista e outra clínica não veem.
    expect((await reception.from("patient_credits").insert({ clinic_id: clinicId, patient_id: patientId, amount_cents: 999999, kind: "entrada" })).error).not.toBeNull();
    expect((await dentist.from("patient_credits").select("id").eq("patient_id", patientId)).data).toEqual([]);
    expect(await balance(dentist)).toBe(0);
    expect((await other.from("patient_credits").select("id").eq("patient_id", patientId)).data).toEqual([]);

    // Crédito menor que a parcela: recusa.
    const big = await newReceivable(8000);
    expect((await reception.rpc("use_patient_credit", { _receivable_id: big, _paid_on: today })).error?.code).toBe("OF020");

    const r2 = await newReceivable(4000);
    const cashBefore = (await admin.from("cash_movements").select("id").eq("receivable_id", r2)).data!.length;
    expect((await reception.rpc("use_patient_credit", { _receivable_id: r2, _paid_on: today })).error).toBeNull();
    expect(await balance()).toBe(1000);
    expect((await admin.from("receivables").select("status").eq("id", r2).single()).data!.status).toBe("paid");
    expect((await admin.from("cash_movements").select("id").eq("receivable_id", r2)).data!.length).toBe(cashBefore);

    // Estorno do pagamento com crédito: o crédito volta, sem saída de caixa.
    expect((await owner.rpc("reverse_payment", { _receivable_id: r2 })).error).toBeNull();
    expect(await balance()).toBe(5000);
    expect((await admin.from("cash_movements").select("id").eq("receivable_id", r2)).data).toEqual([]);

    // Estorno do pagamento a mais: o crédito gerado sai (já que ainda não foi usado).
    expect((await owner.rpc("reverse_payment", { _receivable_id: r1 })).error).toBeNull();
    expect(await balance()).toBe(0);
  });

  it("lançamento manual só pela gestão", async () => {
    expect((await reception.rpc("add_patient_credit", { _patient_id: patientId, _amount_cents: 2000, _notes: "Adiantamento" })).error?.code).toBe("42501");
    expect((await owner.rpc("add_patient_credit", { _patient_id: patientId, _amount_cents: 2000, _notes: "Adiantamento" })).error).toBeNull();
    expect(await balance()).toBe(2000);
  });

  it("mensalidade: gera uma parcela por mês até o seguinte, sem duplicar; encerrar não apaga; dentista não cria", async () => {
    const start = `${today.slice(0, 7)}-01`;
    expect(
      (await dentist.from("patient_subscriptions").insert({ clinic_id: clinicId, unit_id: unitId, patient_id: patientId, description: "Orto", amount_cents: 25000, due_day: 10, starts_on: start })).error,
    ).not.toBeNull();
    const { data: sub, error } = await reception
      .from("patient_subscriptions")
      .insert({ clinic_id: clinicId, unit_id: unitId, patient_id: patientId, description: "Manutenção ortodôntica", amount_cents: 25000, due_day: 10, starts_on: start })
      .select("id")
      .single();
    expect(error).toBeNull();
    expect((await reception.rpc("generate_my_subscription_receivables", { _subscription_id: sub!.id })).data).toBe(2);
    expect((await reception.rpc("generate_my_subscription_receivables", { _subscription_id: sub!.id })).data).toBe(0);
    const { data: recs } = await admin.from("receivables").select("due_date, competence, amount_cents, description").eq("subscription_id", sub!.id).order("competence");
    expect(recs).toHaveLength(2);
    expect(recs![0]!.due_date.endsWith("-10")).toBe(true);
    expect(recs![0]!.description).toMatch(/^Mensalidade Manutenção ortodôntica \(\d{2}\/\d{4}\)$/);

    // Outra clínica não dispara a geração desta.
    expect((await other.rpc("generate_my_subscription_receivables", { _subscription_id: sub!.id })).error).not.toBeNull();

    // Valor não muda depois de criada; encerrar mantém as parcelas.
    expect((await reception.from("patient_subscriptions").update({ amount_cents: 1 }).eq("id", sub!.id)).error).not.toBeNull();
    expect((await reception.from("patient_subscriptions").update({ active: false, ends_on: today }).eq("id", sub!.id).select("id")).data).toHaveLength(1);
    expect((await admin.from("receivables").select("id").eq("subscription_id", sub!.id)).data).toHaveLength(2);
  });
});
