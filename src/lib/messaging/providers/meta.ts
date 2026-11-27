import "server-only";

import type { MessageKind, MessagingProvider, OutgoingMessage, SendResult } from "../types";

type MetaConfig = {
  token: string;
  phoneNumberId: string;
  language: string;
  templates: Record<MessageKind, string>;
};

/** Ordem dos parâmetros {{1}}, {{2}}... em cada modelo aprovado na Meta. */
const TEMPLATE_PARAMS: Record<MessageKind, (keyof OutgoingMessage["variables"])[]> = {
  appointment_reminder: ["paciente", "clinica", "data", "hora", "profissional"],
  appointment_confirmation: ["paciente", "data", "hora"],
  birthday: ["paciente", "clinica"],
  return_reminder: ["paciente", "clinica"],
  payment_reminder: ["paciente", "valor", "vencimento", "link"],
  booking_code: ["codigo"],
  review_request: ["paciente", "clinica", "link"],
};

/**
 * WhatsApp Cloud API (oficial da Meta). Mensagens iniciadas pela clínica usam
 * modelos aprovados na Meta (nome configurado por tipo); respostas dentro de
 * uma conversa aberta pelo paciente vão como texto livre.
 */
export class MetaProvider implements MessagingProvider {
  readonly name = "meta";

  constructor(private readonly config: MetaConfig) {}

  private async post(body: unknown): Promise<string | null> {
    const response = await fetch(`https://graph.facebook.com/v21.0/${this.config.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.config.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } };
    if (!response.ok) throw new Error(data.error?.message ?? `WhatsApp respondeu ${response.status}`);
    return data.messages?.[0]?.id ?? null;
  }

  async send(message: OutgoingMessage): Promise<SendResult> {
    if (message.isReply) {
      const id = await this.post({ messaging_product: "whatsapp", to: message.to, type: "text", text: { body: message.text } });
      return { status: "sent", providerId: id };
    }

    const components: unknown[] = [
      {
        type: "body",
        parameters: TEMPLATE_PARAMS[message.kind].map((key) => ({ type: "text", text: message.variables[key] ?? "-" })),
      },
    ];
    if (message.confirmPayload) {
      components.push({ type: "button", sub_type: "quick_reply", index: "0", parameters: [{ type: "payload", payload: message.confirmPayload }] });
    }
    const id = await this.post({
      messaging_product: "whatsapp",
      to: message.to,
      type: "template",
      template: { name: this.config.templates[message.kind], language: { code: this.config.language }, components },
    });
    return { status: "sent", providerId: id };
  }
}
