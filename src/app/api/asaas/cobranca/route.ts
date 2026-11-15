import { NextResponse } from "next/server";

import { handleClinicWebhook } from "@/features/charges/service";

/** Webhook da conta Asaas de cada clínica (cobrança de pacientes). */
export async function POST(request: Request) {
  const token = request.headers.get("asaas-access-token") ?? "";
  const payload = await request.json().catch(() => null);
  if (!payload) return NextResponse.json({ ok: false }, { status: 400 });
  const { status } = await handleClinicWebhook(token, payload);
  return NextResponse.json({ ok: status === 200 }, { status });
}
