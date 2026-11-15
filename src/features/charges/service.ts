import "server-only";

import { randomUUID } from "node:crypto";

import { cancelPayment, checkCredentials, createCustomer, createPayment, getPixQrCode, type AsaasCredentials, type AsaasPayment } from "@/lib/asaas-clinic";
import { todayIso } from "@/lib/dates";
import { decryptSecret, encryptSecret } from "@/lib/secrets";
import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";

type UserClient = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>;
export type ChargeKind = "pix" | "boleto" | "link";
export type ChargeView = {
  id: string;
  kind: ChargeKind;
  amountCents: number;
  dueDate: string;
  installments: number;
  status: string;
  invoiceUrl: string | null;
  bankSlipUrl: string | null;
  pixPayload: string | null;
  receivableIds: string[];
};

/** Cliente do paciente no Asaas da clínica (cria na primeira vez; exige CPF). */
export async function ensureAsaasCustomer(
  cred: AsaasCredentials,
  patient: { id: string; full_name: string; cpf: string | null; email: string | null; whatsapp: string | null; phone: string | null; asaas_customer_id: string | null },
  purpose: string,
): Promise<{ customerId: string } | { error: string }> {
  if (patient.asaas_customer_id) return { customerId: patient.asaas_customer_id };
  if (!patient.cpf) return { error: `Cadastre o CPF do paciente para ${purpose}.` };
  const customer = await createCustomer(cred, {
    name: patient.full_name,
    cpfCnpj: patient.cpf,
    email: patient.email,
    mobilePhone: patient.whatsapp ?? patient.phone,
    externalReference: patient.id,
  });
  await createAdminClient().from("patients").update({ asaas_customer_id: customer.id }).eq("id", patient.id);
  return { customerId: customer.id };
}

/** A clínica tem conta Asaas conectada? (lido pelo servidor: a recepção não vê a configuração.) */
export async function isOnlineBillingEnabled(clinicId: string): Promise<boolean> {
  const { data } = await createAdminClient().from("clinic_billing").select("connected_at").eq("clinic_id", clinicId).maybeSingle();
  return Boolean(data?.connected_at);
}

/** Cobranças em aberto (ou todas de um paciente). */
export async function listCharges(supabase: UserClient, filter: { patientId?: string; openOnly?: boolean }): Promise<ChargeView[]> {
  let q = supabase
    .from("patient_charges")
    .select("id, kind, amount_cents, due_date, installments, status, invoice_url, bank_slip_url, pix_payload, receivable_ids")
    .order("created_at", { ascending: false })
    .limit(500);
  if (filter.patientId) q = q.eq("patient_id", filter.patientId);
  if (filter.openOnly) q = q.in("status", ["pending", "overdue"]);
  const { data } = await q;
  return (data ?? []).map((c) => ({
    id: c.id,
    kind: c.kind,
    amountCents: c.amount_cents,
    dueDate: c.due_date,
    installments: c.installments,
    status: c.status,
    invoiceUrl: c.invoice_url,
    bankSlipUrl: c.bank_slip_url,
    pixPayload: c.pix_payload,
    receivableIds: c.receivable_ids,
  }));
}

/** Credenciais do Asaas da clínica (só no servidor). */
export async function getClinicCredentials(clinicId: string): Promise<AsaasCredentials | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("clinic_billing").select("api_key_encrypted, environment").eq("clinic_id", clinicId).maybeSingle();
  if (!data?.api_key_encrypted) return null;
  return { apiKey: decryptSecret(data.api_key_encrypted), environment: data.environment as AsaasCredentials["environment"] };
}

/** Valida a chave no Asaas e guarda criptografada. */
export async function connectClinicAsaas(clinicId: string, apiKey: string, environment: AsaasCredentials["environment"], check = checkCredentials) {
  await check({ apiKey, environment });
  const admin = createAdminClient();
  const { data: previous } = await admin.from("clinic_billing").select("environment").eq("clinic_id", clinicId).maybeSingle();
  const { error } = await admin.from("clinic_billing").upsert({
    clinic_id: clinicId,
    environment,
    api_key_encrypted: encryptSecret(apiKey),
    api_key_hint: apiKey.slice(-4),
    connected_at: new Date().toISOString(),
  });
  if (error) throw new Error("Não foi possível salvar a conexão.");
  // Clientes do Asaas são por conta/ambiente: trocou de ambiente, cadastra de novo.
  if (previous && previous.environment !== environment) {
    await admin.from("patients").update({ asaas_customer_id: null }).eq("clinic_id", clinicId).not("asaas_customer_id", "is", null);
  }
}

export async function disconnectClinicAsaas(clinicId: string) {
  const admin = createAdminClient();
  await admin.from("clinic_billing").update({ api_key_encrypted: null, api_key_hint: null, connected_at: null }).eq("clinic_id", clinicId);
}

/**
 * Cria a cobrança no Asaas da clínica para uma ou mais parcelas em aberto do
 * mesmo paciente. A permissão é conferida lendo as parcelas com o cliente do
 * usuário (RLS); a gravação usa o servidor.
 */
export async function createCharge(
  ctx: { supabase: UserClient; clinicId: string; userId: string | null },
  input: { receivableIds: string[]; kind: ChargeKind; installments: number; dueDate: string | null },
): Promise<{ error?: string; charge?: ChargeView }> {
  const { data: receivables } = await ctx.supabase
    .from("receivables")
    .select("id, patient_id, amount_cents, due_date, status, description, patients(full_name, cpf, email, whatsapp, phone, asaas_customer_id)")
    .in("id", input.receivableIds);
  if (!receivables || receivables.length !== input.receivableIds.length) return { error: "Parcela não encontrada." };
  if (receivables.some((r) => r.status !== "open" && r.status !== "overdue")) return { error: "Só parcelas em aberto podem ser cobradas." };
  const patientIds = new Set(receivables.map((r) => r.patient_id));
  if (patientIds.size !== 1) return { error: "Escolha parcelas de um mesmo paciente." };
  const patient = receivables[0]!.patients;
  const patientId = receivables[0]!.patient_id;
  if (!patient) return { error: "Paciente não encontrado." };
  if (input.kind !== "link" && input.installments > 1) return { error: "Parcelamento só no link (cartão)." };

  const { data: pending } = await ctx.supabase.from("patient_charges").select("id").in("status", ["pending", "overdue"]).overlaps("receivable_ids", input.receivableIds).limit(1);
  if (pending?.length) return { error: "Já existe uma cobrança em aberto para essa parcela. Cancele-a antes de gerar outra." };

  const cred = await getClinicCredentials(ctx.clinicId);
  if (!cred) return { error: "Conecte a conta Asaas da clínica em Configurações > Cobrança online." };

  const admin = createAdminClient();
  const customer = await ensureAsaasCustomer(cred, { id: patientId, ...patient }, "gerar a cobrança");
  if ("error" in customer) return { error: customer.error };
  const customerId = customer.customerId;

  const today = todayIso();
  const earliest = receivables.map((r) => r.due_date).sort()[0]!;
  const dueDate = input.dueDate && input.dueDate >= today ? input.dueDate : earliest >= today ? earliest : today;
  const amountCents = receivables.reduce((s, r) => s + r.amount_cents, 0);
  const chargeId = randomUUID();
  const billingType = input.kind === "pix" ? "PIX" : input.kind === "boleto" ? "BOLETO" : input.installments > 1 ? "CREDIT_CARD" : "UNDEFINED";
  const description = receivables.length === 1 ? receivables[0]!.description : `${receivables.length} parcelas`;

  const payment = await createPayment(cred, {
    customer: customerId,
    billingType,
    value: amountCents / 100,
    dueDate,
    description,
    externalReference: chargeId,
    installmentCount: input.kind === "link" ? input.installments : undefined,
  });
  const pix = input.kind === "pix" ? await getPixQrCode(cred, payment.id).catch(() => null) : null;

  const { error } = await admin.from("patient_charges").insert({
    id: chargeId,
    clinic_id: ctx.clinicId,
    patient_id: patientId,
    receivable_ids: input.receivableIds,
    kind: input.kind,
    amount_cents: amountCents,
    due_date: dueDate,
    installments: input.kind === "link" ? input.installments : 1,
    asaas_payment_id: payment.id,
    asaas_installment_id: payment.installment ?? null,
    invoice_url: payment.invoiceUrl,
    bank_slip_url: payment.bankSlipUrl ?? null,
    pix_payload: pix?.payload ?? null,
    created_by: ctx.userId,
  });
  if (error) {
    await cancelPayment(cred, payment.id).catch(() => undefined);
    return { error: "Não foi possível registrar a cobrança." };
  }
  return {
    charge: { id: chargeId, kind: input.kind, amountCents, dueDate, installments: input.kind === "link" ? input.installments : 1, status: "pending", invoiceUrl: payment.invoiceUrl, bankSlipUrl: payment.bankSlipUrl ?? null, pixPayload: pix?.payload ?? null, receivableIds: input.receivableIds },
  };
}

export async function cancelCharge(ctx: { supabase: UserClient; clinicId: string }, chargeId: string): Promise<{ error?: string }> {
  const { data: charge } = await ctx.supabase.from("patient_charges").select("id, status, asaas_payment_id").eq("id", chargeId).maybeSingle();
  if (!charge) return { error: "Cobrança não encontrada." };
  if (charge.status !== "pending" && charge.status !== "overdue") return { error: "Só cobranças em aberto podem ser canceladas." };
  const cred = await getClinicCredentials(ctx.clinicId);
  if (cred && charge.asaas_payment_id) {
    try {
      await cancelPayment(cred, charge.asaas_payment_id);
    } catch {
      return { error: "O Asaas não cancelou a cobrança. Tente de novo." };
    }
  }
  await createAdminClient().from("patient_charges").update({ status: "canceled" }).eq("id", chargeId);
  return {};
}

type WebhookPayload = { event?: string; payment?: AsaasPayment };

/**
 * Notificação do Asaas da clínica. O token do cabeçalho identifica a clínica;
 * pagamento confirmado dá baixa nas parcelas com a taxa real.
 */
/** Clínica dona do token do webhook (ou nulo). */
export async function clinicFromWebhookToken(token: string): Promise<string | null> {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const { data } = await createAdminClient().from("clinic_billing").select("clinic_id").eq("webhook_token", token).maybeSingle();
  return data?.clinic_id ?? null;
}

export async function handleClinicWebhook(token: string, payload: WebhookPayload): Promise<{ status: number; settled?: { clinicId: string; receivableIds: string[] } }> {
  const clinicId = await clinicFromWebhookToken(token);
  if (!clinicId) return { status: 401 };
  const admin = createAdminClient();
  const billing = { clinic_id: clinicId };
  const p = payload.payment;
  const ref = p?.externalReference ?? "";
  if (!p || !/^[0-9a-f-]{36}$/i.test(ref)) return { status: 200 };
  const { data: charge } = await admin.from("patient_charges").select("id, status, amount_cents, installments, receivable_ids").eq("id", ref).eq("clinic_id", billing.clinic_id).maybeSingle();
  if (!charge) return { status: 200 };

  switch (payload.event) {
    case "PAYMENT_RECEIVED":
    case "PAYMENT_CONFIRMED": {
      const value = Math.round(p.value * 100);
      const net = p.netValue === undefined ? value : Math.round(p.netValue * 100);
      // Cartão parcelado: cada parcela do Asaas vem num aviso; a primeira confirma a compra toda.
      const parcelled = Boolean(p.installment) && charge.installments > 1;
      const paid = parcelled ? charge.amount_cents : value;
      const fee = Math.max(0, (value - net) * (parcelled ? charge.installments : 1));
      const paidOn = (p.clientPaymentDate ?? p.paymentDate ?? p.confirmedDate ?? todayIso()).slice(0, 10);
      const { error } = await admin.rpc("settle_online_charge", { _charge_id: charge.id, _paid_cents: paid, _fee_cents: fee, _paid_on: paidOn });
      if (error) return { status: 500 };
      return { status: 200, settled: charge.status === "paid" ? undefined : { clinicId, receivableIds: charge.receivable_ids } };
    }
    case "PAYMENT_OVERDUE":
      if (charge.status === "pending") await admin.from("patient_charges").update({ status: "overdue" }).eq("id", charge.id);
      return { status: 200 };
    case "PAYMENT_DELETED":
      if (charge.status === "pending" || charge.status === "overdue") await admin.from("patient_charges").update({ status: "canceled" }).eq("id", charge.id);
      return { status: 200 };
    case "PAYMENT_REFUNDED":
      // A parcela continua paga: o estorno no caixa é feito pela clínica.
      await admin.from("patient_charges").update({ status: "refunded" }).eq("id", charge.id);
      return { status: 200 };
    default:
      return { status: 200 };
  }
}
