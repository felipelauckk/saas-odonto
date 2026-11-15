import { NextResponse } from "next/server";

import { clinicFromWebhookToken, handleClinicWebhook } from "@/features/charges/service";
import { applyInvoiceWebhook, autoIssueInvoices } from "@/features/invoices/service";
import type { AsaasInvoice } from "@/lib/asaas-clinic";

/** Webhook da conta Asaas de cada clínica (cobranças e notas fiscais de pacientes). */
export async function POST(request: Request) {
  const token = request.headers.get("asaas-access-token") ?? "";
  const payload = (await request.json().catch(() => null)) as { event?: string; invoice?: AsaasInvoice } | null;
  if (!payload) return NextResponse.json({ ok: false }, { status: 400 });

  if (payload.event?.startsWith("INVOICE_") && payload.invoice?.id) {
    const clinicId = await clinicFromWebhookToken(token);
    if (!clinicId) return NextResponse.json({ ok: false }, { status: 401 });
    await applyInvoiceWebhook(clinicId, payload.invoice);
    return NextResponse.json({ ok: true });
  }

  const { status, settled } = await handleClinicWebhook(token, payload);
  // Pagamento confirmado: nota fiscal automática, se a clínica ligou.
  if (settled) await autoIssueInvoices(settled.clinicId, settled.receivableIds);
  return NextResponse.json({ ok: status === 200 }, { status });
}
