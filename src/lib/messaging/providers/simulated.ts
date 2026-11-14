import type { MessagingProvider, SendResult } from "../types";

/**
 * Provedor padrão enquanto nenhum WhatsApp está configurado: não envia nada,
 * só deixa o registro no log com status "simulado".
 */
export class SimulatedProvider implements MessagingProvider {
  readonly name = "simulado";

  async send(): Promise<SendResult> {
    return { status: "simulated", providerId: null };
  }
}
