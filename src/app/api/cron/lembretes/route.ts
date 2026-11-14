import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { runDailyMessages } from "@/features/messaging/service";

/**
 * Rotina diária (Vercel Cron, ver vercel.json): lembretes das consultas de amanhã
 * e mensagens de aniversário. Protegida pelo CRON_SECRET, que a Vercel envia
 * no cabeçalho Authorization.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const ok = Boolean(secret) && header.length === expected.length && timingSafeEqual(Buffer.from(header), Buffer.from(expected));
  if (!ok) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const summary = await runDailyMessages();
  return NextResponse.json(summary);
}
