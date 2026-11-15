import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { handleInboundMessage } from "@/features/ai/assistant";
import { confirmFromButton } from "@/features/messaging/service";

/** Verificação do webhook pela Meta (configuração inicial). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (token && url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === token) {
    return new NextResponse(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("Não autorizado.", { status: 403 });
}

type WebhookBody = {
  entry?: {
    changes?: {
      value?: {
        metadata?: { phone_number_id?: string };
        messages?: { from?: string; type?: string; text?: { body?: string }; button?: { payload?: string }; interactive?: { button_reply?: { id?: string } } }[];
      };
    }[];
  }[];
};

/** Respostas do paciente. Só a assinatura da Meta (WHATSAPP_APP_SECRET) é aceita. */
export async function POST(request: Request) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  const raw = await request.text();
  const signature = request.headers.get("x-hub-signature-256") ?? "";
  const expected = secret ? `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}` : "";
  if (!secret || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return new NextResponse("Assinatura inválida.", { status: 401 });
  }

  const body = JSON.parse(raw) as WebhookBody;
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const message of change.value?.messages ?? []) {
        const payload = message.button?.payload ?? message.interactive?.button_reply?.id;
        if (payload) await confirmFromButton(payload);
        // Texto livre: vai para a caixa de entrada e, se ligado, para o assistente.
        else if (message.type === "text" && message.from && message.text?.body) {
          await handleInboundMessage({ phoneNumberId: change.value?.metadata?.phone_number_id ?? null, from: message.from, text: message.text.body.slice(0, 4000) });
        }
      }
    }
  }
  // A Meta só precisa do 200; responder rápido evita reenvios.
  return NextResponse.json({ ok: true });
}
