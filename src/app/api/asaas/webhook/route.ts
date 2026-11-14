import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { applyAsaasEvent, type AsaasEvent } from "@/features/billing/webhook";

/** Webhook do Asaas. Autenticado pelo token configurado no painel do Asaas (ASAAS_WEBHOOK_TOKEN). */
export async function POST(request: Request) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN ?? "";
  const received = request.headers.get("asaas-access-token") ?? "";
  if (!expected || received.length !== expected.length || !timingSafeEqual(Buffer.from(received), Buffer.from(expected))) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const event = (await request.json().catch(() => null)) as AsaasEvent | null;
  if (!event?.event) return NextResponse.json({ error: "Evento inválido." }, { status: 400 });

  await applyAsaasEvent(event);
  // Sempre 200 para eventos válidos: o Asaas pausa a fila se receber erros seguidos.
  return NextResponse.json({ ok: true });
}
