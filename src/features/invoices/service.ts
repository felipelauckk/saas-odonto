import "server-only";

import { ensureAsaasCustomer, getClinicCredentials } from "@/features/charges/service";
import { AsaasClinicError, authorizeInvoice, cancelInvoice, createInvoice, type AsaasInvoice } from "@/lib/asaas-clinic";
import { todayIso } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";

import { invoiceTaxes, mapAsaasInvoiceStatus, type InvoiceStatus } from "./logic";

type UserClient = Awaited<ReturnType<typeof createClient>>;
type Admin = ReturnType<typeof createAdminClient>;

/**
 * Emite a NFS-e de um recebimento. Com `ctx.supabase` do usuário, a leitura da
 * parcela confirma a permissão (RLS); a emissão automática usa o servidor.
 */
export async function issueInvoice(ctx: { supabase: UserClient | Admin; clinicId: string; userId: string | null }, receivableId: string): Promise<{ error?: string; status?: InvoiceStatus }> {
  const admin = createAdminClient();
  const { data: r } = await ctx.supabase
    .from("receivables")
    .select("id, clinic_id, patient_id, status, paid_amount_cents, description, patients(id, full_name, cpf, email, whatsapp, phone, asaas_customer_id)")
    .eq("id", receivableId)
    .eq("clinic_id", ctx.clinicId)
    .maybeSingle();
  if (!r || !r.patients) return { error: "Recebimento não encontrado." };
  if (r.status !== "paid" || !r.paid_amount_cents) return { error: "Só recebimentos pagos geram nota." };
  const { data: existing } = await admin.from("service_invoices").select("id").eq("receivable_id", receivableId).in("status", ["processing", "authorized"]).limit(1);
  if (existing?.length) return { error: "Este recebimento já tem nota." };
  const { data: settings } = await admin.from("clinic_fiscal_settings").select("*").eq("clinic_id", ctx.clinicId).maybeSingle();
  if (!settings?.enabled || !settings.municipal_service_code) return { error: "Configure a nota fiscal em Configurações > Nota fiscal." };
  const cred = await getClinicCredentials(ctx.clinicId);
  if (!cred) return { error: "Conecte a conta Asaas da clínica em Configurações > Cobrança online." };

  const description = `${settings.service_description} — ${r.description}`.slice(0, 500);
  const record = { clinic_id: ctx.clinicId, patient_id: r.patient_id, receivable_id: r.id, amount_cents: r.paid_amount_cents, description, created_by: ctx.userId };
  try {
    const customer = await ensureAsaasCustomer(cred, r.patients, "emitir a nota fiscal");
    if ("error" in customer) return { error: customer.error };
    const { data: row, error: insertError } = await admin.from("service_invoices").insert({ ...record, status: "processing" }).select("id").single();
    if (insertError) return { error: insertError.code === "23505" ? "Este recebimento já tem nota." : "Não foi possível registrar a nota." };
    let invoice: AsaasInvoice = await createInvoice(cred, {
      customer: customer.customerId,
      serviceDescription: description,
      observations: "Nota emitida pelo sistema da clínica.",
      value: r.paid_amount_cents / 100,
      effectiveDate: todayIso(),
      municipalServiceCode: settings.municipal_service_code,
      municipalServiceName: settings.municipal_service_name ?? settings.service_description,
      externalReference: row.id,
      taxes: invoiceTaxes(Number(settings.iss_rate), settings.retain_iss),
    });
    invoice = await authorizeInvoice(cred, invoice.id).catch(() => invoice);
    const status = mapAsaasInvoiceStatus(invoice.status);
    await admin.from("service_invoices").update(fromAsaas(invoice, status)).eq("id", row.id);
    return { status };
  } catch (e) {
    const message = e instanceof AsaasClinicError ? e.message : "Não foi possível emitir a nota agora.";
    await admin.from("service_invoices").update({ status: "error", error: message.slice(0, 500) }).eq("receivable_id", r.id).eq("status", "processing");
    return { error: message };
  }
}

function fromAsaas(invoice: AsaasInvoice, status: InvoiceStatus) {
  return {
    asaas_invoice_id: invoice.id,
    status,
    number: invoice.number ?? null,
    pdf_url: invoice.pdfUrl ?? null,
    xml_url: invoice.xmlUrl ?? null,
    error: status === "error" ? (invoice.statusDescription ?? "A prefeitura recusou a nota.").slice(0, 500) : null,
    // A data de emissão só é gravada quando a nota sai (e nunca é apagada depois).
    ...(status === "authorized" ? { issued_at: new Date().toISOString() } : {}),
  };
}

export async function cancelServiceInvoice(ctx: { supabase: UserClient; clinicId: string }, invoiceId: string): Promise<{ error?: string }> {
  const { data: inv } = await ctx.supabase.from("service_invoices").select("id, status, asaas_invoice_id").eq("id", invoiceId).maybeSingle();
  if (!inv) return { error: "Nota não encontrada." };
  const admin = createAdminClient();
  if (!inv.asaas_invoice_id || inv.status === "error") {
    await admin.from("service_invoices").update({ status: "canceled", canceled_at: new Date().toISOString() }).eq("id", inv.id);
    return {};
  }
  if (inv.status !== "authorized" && inv.status !== "processing") return { error: "Esta nota não pode ser cancelada." };
  const cred = await getClinicCredentials(ctx.clinicId);
  if (!cred) return { error: "Conta Asaas desconectada." };
  try {
    const result = await cancelInvoice(cred, inv.asaas_invoice_id);
    const status = mapAsaasInvoiceStatus(result.status, inv.status as InvoiceStatus);
    await admin.from("service_invoices").update({ status, canceled_at: status === "canceled" ? new Date().toISOString() : null }).eq("id", inv.id);
    return status === "canceled" || result.status === "PROCESSING_CANCELLATION" ? {} : { error: "A prefeitura não aceitou o cancelamento." };
  } catch (e) {
    return { error: e instanceof AsaasClinicError ? e.message : "Não foi possível cancelar agora." };
  }
}

/** Emissão automática ao receber (quando a clínica ligou). Erros ficam registrados na nota. */
export async function autoIssueInvoices(clinicId: string, receivableIds: string[]) {
  const admin = createAdminClient();
  const { data: settings } = await admin.from("clinic_fiscal_settings").select("enabled, auto_issue").eq("clinic_id", clinicId).maybeSingle();
  if (!settings?.enabled || !settings.auto_issue) return;
  for (const id of receivableIds) await issueInvoice({ supabase: admin, clinicId, userId: null }, id).catch(() => undefined);
}

/** Aviso do Asaas sobre a nota (INVOICE_*). */
export async function applyInvoiceWebhook(clinicId: string, invoice: AsaasInvoice) {
  const admin = createAdminClient();
  const { data: inv } = await admin.from("service_invoices").select("id, status").eq("clinic_id", clinicId).eq("asaas_invoice_id", invoice.id).maybeSingle();
  if (!inv) return;
  const status = mapAsaasInvoiceStatus(invoice.status, inv.status as InvoiceStatus);
  if (inv.status === "authorized" && status === "authorized") return; // aviso repetido
  await admin
    .from("service_invoices")
    .update({ ...fromAsaas(invoice, status), ...(status === "canceled" ? { canceled_at: new Date().toISOString() } : {}) })
    .eq("id", inv.id);
}
