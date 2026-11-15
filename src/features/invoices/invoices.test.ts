/**
 * NFS-e com o Asaas simulado: emite a partir do recebimento pago, não emite
 * duas vezes, erro da prefeitura fica na nota (e permite tentar de novo),
 * emissão automática só quando ligada, aviso de cancelamento pelo webhook e
 * permissões (recepção lê; ninguém grava direto).
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { connectClinicAsaas } from "@/features/charges/service";
import { todayIso } from "@/lib/dates";
import { createTestEnv, hasSupabase, type Client } from "@/test/supabase";

import { applyInvoiceWebhook, autoIssueInvoices, issueInvoice } from "./service";

describe.skipIf(!hasSupabase)("nota fiscal de serviço", () => {
  const env = createTestEnv("nfse");
  const admin = env.admin;
  const realFetch = globalThis.fetch;
  let failNext = false;
  const calls: { url: string; body: unknown }[] = [];

  let reception: Client;
  let clinicId = "";
  let unitId = "";
  let patientId = "";
  let receptionUserId = "";

  async function paidReceivable(amount: number) {
    const { data, error } = await admin
      .from("receivables")
      .insert({ clinic_id: clinicId, unit_id: unitId, patient_id: patientId, description: "Limpeza", amount_cents: amount, due_date: todayIso(), status: "paid", paid_at: new Date().toISOString(), paid_amount_cents: amount })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  }

  beforeAll(async () => {
    vi.stubEnv("CLINIC_SECRETS_KEY", Buffer.alloc(32, 9).toString("base64"));
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (!url.includes("asaas.com")) return realFetch(input, init);
      calls.push({ url, body: typeof init?.body === "string" ? JSON.parse(init.body) : null });
      const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/customers")) return json({ id: "cus_nf" });
      if (url.endsWith("/invoices")) {
        if (failNext) {
          failNext = false;
          return json({ errors: [{ description: "Código de serviço inválido para o município." }] }, 400);
        }
        return json({ id: `inv_${calls.length}`, status: "SCHEDULED" });
      }
      if (url.endsWith("/authorize")) return json({ id: url.split("/").at(-2), status: "AUTHORIZED", number: "123", pdfUrl: "https://asaas.test/nota.pdf" });
      return json({});
    });
    const owner = await env.createUser("owner", "Clínica NFS-e");
    const receptionUser = await env.createUser("recepcao");
    clinicId = owner.clinicId!;
    receptionUserId = receptionUser.userId;
    await env.addMember(clinicId, receptionUser.userId, "receptionist");
    const { data: unit } = await admin.from("units").select("id").eq("clinic_id", clinicId).single();
    unitId = unit!.id;
    const { data: p } = await admin.from("patients").insert({ clinic_id: clinicId, full_name: "Paciente Nota", cpf: "52998224725" }).select("id").single();
    patientId = p!.id;
    await connectClinicAsaas(clinicId, "$aact_chave_nfse_teste_1234567890", "sandbox", async () => undefined);
    await admin.from("clinic_fiscal_settings").insert({ clinic_id: clinicId, enabled: true, municipal_service_code: "04.12", iss_rate: 2 });
    reception = await env.signIn("recepcao");
  });

  afterEach(() => {
    calls.length = 0;
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    await env.cleanup();
  });

  it("emite a nota do recebimento pago e não emite de novo", async () => {
    const id = await paidReceivable(30000);
    const result = await issueInvoice({ supabase: reception as never, clinicId, userId: receptionUserId }, id);
    expect(result).toEqual({ status: "authorized" });
    const invoiceCall = calls.find((c) => c.url.endsWith("/invoices"))!.body as Record<string, unknown>;
    expect(invoiceCall).toMatchObject({ customer: "cus_nf", value: 300, municipalServiceCode: "04.12", taxes: { iss: 2, retainIss: false } });
    const { data: rows } = await reception.from("service_invoices").select("status, number, pdf_url, amount_cents").eq("receivable_id", id);
    expect(rows).toEqual([{ status: "authorized", number: "123", pdf_url: "https://asaas.test/nota.pdf", amount_cents: 30000 }]);
    expect((await issueInvoice({ supabase: reception as never, clinicId, userId: receptionUserId }, id)).error).toMatch(/já tem nota/);
    // Ninguém grava nota direto pelo app.
    expect((await reception.from("service_invoices").update({ status: "canceled" } as never).eq("receivable_id", id).select("id")).data ?? []).toEqual([]);
  });

  it("erro da prefeitura fica registrado e permite tentar de novo", async () => {
    const id = await paidReceivable(15000);
    failNext = true;
    expect((await issueInvoice({ supabase: reception as never, clinicId, userId: receptionUserId }, id)).error).toMatch(/Código de serviço inválido/);
    const { data: errored } = await admin.from("service_invoices").select("status, error").eq("receivable_id", id);
    expect(errored).toEqual([{ status: "error", error: "Código de serviço inválido para o município." }]);
    expect((await issueInvoice({ supabase: reception as never, clinicId, userId: receptionUserId }, id)).status).toBe("authorized");
  });

  it("emissão automática só quando ligada; webhook avisa o cancelamento", async () => {
    const id = await paidReceivable(10000);
    await autoIssueInvoices(clinicId, [id]);
    expect((await admin.from("service_invoices").select("id").eq("receivable_id", id)).data).toEqual([]);
    await admin.from("clinic_fiscal_settings").update({ auto_issue: true }).eq("clinic_id", clinicId);
    await autoIssueInvoices(clinicId, [id]);
    const { data: inv } = await admin.from("service_invoices").select("asaas_invoice_id, status").eq("receivable_id", id).single();
    expect(inv!.status).toBe("authorized");

    await applyInvoiceWebhook(clinicId, { id: inv!.asaas_invoice_id!, status: "CANCELED" });
    expect((await admin.from("service_invoices").select("status, canceled_at").eq("receivable_id", id).single()).data).toMatchObject({ status: "canceled" });
  });
});
