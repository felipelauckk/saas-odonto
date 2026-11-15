/**
 * Cobrança online e régua: chave da clínica protegida, cobrança criada no
 * Asaas (simulado), webhook com token da clínica dá baixa com a taxa real
 * (uma vez só) e régua que avisa uma vez por etapa e respeita a negociação.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { todayIso } from "@/lib/dates";
import { addDays } from "@/lib/timezone";
import { createTestEnv, hasSupabase, type Client } from "@/test/supabase";

import { connectClinicAsaas, createCharge, getClinicCredentials, handleClinicWebhook } from "./service";

describe.skipIf(!hasSupabase)("cobrança online e régua", () => {
  const env = createTestEnv("cobranca");
  const admin = env.admin;
  const today = todayIso();
  const realFetch = globalThis.fetch;

  let owner: Client;
  let reception: Client;
  let other: Client;
  let clinicId = "";
  let receptionUserId = "";
  let patientId = "";
  let unitId = "";
  let token = "";
  const asaasCalls: { url: string; body: unknown }[] = [];

  async function receivable(amount: number, due: string, description = "Parcela") {
    const { data, error } = await admin
      .from("receivables")
      .insert({ clinic_id: clinicId, unit_id: unitId, patient_id: patientId, description, amount_cents: amount, due_date: due })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  }

  beforeAll(async () => {
    vi.stubEnv("WHATSAPP_PROVIDER", "");
    vi.stubEnv("CLINIC_SECRETS_KEY", Buffer.alloc(32, 3).toString("base64"));
    // Asaas simulado; o resto (Supabase) passa direto.
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (!url.includes("asaas.com")) return realFetch(input, init);
      asaasCalls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
      const json = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/customers")) return json({ id: "cus_test" });
      if (url.endsWith("/payments")) return json({ id: "pay_test", status: "PENDING", value: 300, invoiceUrl: "https://sandbox.asaas.com/i/pay_test", bankSlipUrl: null });
      if (url.endsWith("/pixQrCode")) return json({ encodedImage: "x", payload: "00020126pixcopiaecola" });
      return json({});
    });

    const ownerUser = await env.createUser("owner", "Clínica Cobrança");
    await env.createUser("outra", "Clínica Outra Cobrança");
    const receptionUser = await env.createUser("recepcao");
    clinicId = ownerUser.clinicId!;
    receptionUserId = receptionUser.userId;
    await env.addMember(clinicId, receptionUser.userId, "receptionist");
    const { data: unit } = await admin.from("units").select("id").eq("clinic_id", clinicId).single();
    unitId = unit!.id;
    const { data: p } = await admin.from("patients").insert({ clinic_id: clinicId, full_name: "Paciente Cobrança", cpf: "52998224725", whatsapp: "11988887777" }).select("id").single();
    patientId = p!.id;
    owner = await env.signIn("owner");
    reception = await env.signIn("recepcao");
    other = await env.signIn("outra");
    await connectClinicAsaas(clinicId, "$aact_chave_de_teste_1234567890", "sandbox", async () => undefined);
    token = (await admin.from("clinic_billing").select("webhook_token").eq("clinic_id", clinicId).single()).data!.webhook_token;
  });

  afterEach(() => {
    asaasCalls.length = 0;
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    await env.cleanup();
  });

  it("chave guardada criptografada; ninguém do app lê a chave; recepção nem vê a conexão", async () => {
    const { data: row } = await admin.from("clinic_billing").select("api_key_encrypted, api_key_hint").eq("clinic_id", clinicId).single();
    expect(row!.api_key_encrypted).not.toContain("chave_de_teste");
    expect(row!.api_key_hint).toBe("7890");
    expect((await getClinicCredentials(clinicId))?.apiKey).toBe("$aact_chave_de_teste_1234567890");
    expect((await owner.from("clinic_billing").select("api_key_encrypted")).error).not.toBeNull();
    expect((await owner.from("clinic_billing").select("api_key_hint")).data).toEqual([{ api_key_hint: "7890" }]);
    expect((await reception.from("clinic_billing").select("api_key_hint")).data).toEqual([]);
    expect((await reception.rpc("settle_online_charge" as never, { _charge_id: clinicId, _paid_cents: 1, _fee_cents: 0, _paid_on: today } as never)).error).not.toBeNull();
  });

  it("gera Pix de duas parcelas e o webhook dá baixa com a taxa real, uma vez só", async () => {
    const r1 = await receivable(10000, addDays(today, 5), "Parcela 1/2");
    const r2 = await receivable(20000, addDays(today, 35), "Parcela 2/2");
    const result = await createCharge({ supabase: reception as never, clinicId, userId: receptionUserId }, { receivableIds: [r1, r2], kind: "pix", installments: 1, dueDate: null });
    expect(result.error).toBeUndefined();
    expect(result.charge).toMatchObject({ amountCents: 30000, pixPayload: "00020126pixcopiaecola", dueDate: addDays(today, 5) });
    const payment = asaasCalls.find((c) => c.url.endsWith("/payments"))!.body as Record<string, unknown>;
    expect(payment).toMatchObject({ customer: "cus_test", billingType: "PIX", value: 300, externalReference: result.charge!.id });
    expect((await admin.from("patients").select("asaas_customer_id").eq("id", patientId).single()).data!.asaas_customer_id).toBe("cus_test");

    // Outra cobrança para a mesma parcela é recusada.
    expect((await createCharge({ supabase: reception as never, clinicId, userId: receptionUserId }, { receivableIds: [r1], kind: "boleto", installments: 1, dueDate: null })).error).toMatch(/Já existe/);

    const event = { event: "PAYMENT_RECEIVED", payment: { id: "pay_test", status: "RECEIVED", value: 300, netValue: 298.01, invoiceUrl: "", externalReference: result.charge!.id, paymentDate: today } };
    expect((await handleClinicWebhook("0".repeat(64), event)).status).toBe(401);
    expect((await handleClinicWebhook(token, event)).status).toBe(200);
    expect((await handleClinicWebhook(token, event)).status).toBe(200);

    const { data: recs } = await reception.from("receivables").select("id, status, paid_amount_cents, fee_cents, payment_methods(name)").in("id", [r1, r2]).order("due_date");
    expect(recs!.map((r) => [r.status, r.paid_amount_cents, r.fee_cents, r.payment_methods?.name])).toEqual([
      ["paid", 10000, 66, "Cobrança online"],
      ["paid", 20000, 133, "Cobrança online"],
    ]);
    const { data: cash } = await admin.from("cash_movements").select("amount_cents").in("receivable_id", [r1, r2]);
    expect(cash!.map((c) => c.amount_cents).sort()).toEqual([10000, 20000]);
    expect((await reception.from("patient_charges").select("status").eq("id", result.charge!.id).single()).data!.status).toBe("paid");
    expect((await other.from("patient_charges").select("id").eq("clinic_id", clinicId)).data).toEqual([]);
  });

  it("régua: avisa 3 dias antes uma vez; parcela em negociação não recebe", async () => {
    const soon = await receivable(15000, addDays(today, 3), "Parcela régua");
    const negotiating = await receivable(15000, addDays(today, 3), "Parcela negociando");
    expect((await reception.from("receivables").update({ in_negotiation: true }).eq("id", negotiating).select("id")).data).toHaveLength(1);
    // Só a negociação muda direto; valor e situação continuam protegidos.
    expect((await reception.from("receivables").update({ amount_cents: 1 } as never).eq("id", negotiating)).error).not.toBeNull();
    expect((await reception.from("receivables").update({ status: "paid" } as never).eq("id", negotiating)).error).not.toBeNull();

    const { runDunning } = await import("@/features/messaging/service");
    await runDunning(admin, today, clinicId);
    await runDunning(admin, today, clinicId);

    const { data: logs } = await admin.from("dunning_log").select("receivable_id, offset_days").eq("clinic_id", clinicId);
    expect(logs).toEqual([{ receivable_id: soon, offset_days: -3 }]);
    const { data: messages } = await admin.from("messages_log").select("body").eq("clinic_id", clinicId).eq("template_kind", "payment_reminder");
    expect(messages).toHaveLength(1);
    expect(messages![0]!.body).toMatch(/R\$\s?150,00 vence em \d{2}\/\d{2}\/\d{4}/);
  });
});
