import "server-only";

import { MetaProvider } from "./providers/meta";
import { SimulatedProvider } from "./providers/simulated";
import type { MessagingProvider } from "./types";

/**
 * Provedor de WhatsApp escolhido por variável de ambiente.
 * WHATSAPP_PROVIDER=meta exige WHATSAPP_API_TOKEN e WHATSAPP_PHONE_NUMBER_ID;
 * sem configuração, usa o simulado (nada é enviado, tudo fica no log).
 */
export function getMessagingProvider(): MessagingProvider {
  const env = process.env;
  if (env.WHATSAPP_PROVIDER === "meta" && env.WHATSAPP_API_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID) {
    return new MetaProvider({
      token: env.WHATSAPP_API_TOKEN,
      phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
      language: env.WHATSAPP_TEMPLATE_LANGUAGE || "pt_BR",
      templates: {
        appointment_reminder: env.WHATSAPP_TEMPLATE_REMINDER || "lembrete_consulta",
        appointment_confirmation: env.WHATSAPP_TEMPLATE_CONFIRMATION || "consulta_confirmada",
        birthday: env.WHATSAPP_TEMPLATE_BIRTHDAY || "aniversario",
      },
    });
  }
  return new SimulatedProvider();
}

export function isMessagingConfigured(): boolean {
  return getMessagingProvider().name !== "simulado";
}

export const CONFIRM_PREFIX = "CONFIRMAR:";
