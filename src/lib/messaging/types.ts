import type { Database } from "@/lib/supabase/database.types";

export type MessageKind = Database["public"]["Enums"]["message_kind"];

/** Variáveis disponíveis nos modelos: {{paciente}}, {{clinica}}, {{data}}, {{hora}}, {{profissional}}. */
export type TemplateVariables = {
  paciente: string;
  clinica: string;
  data?: string;
  hora?: string;
  profissional?: string;
  /** Valor em aberto (mensagens da CRC). */
  valor?: string;
};

export type OutgoingMessage = {
  /** Telefone no formato internacional, só dígitos (ex.: 5511988887777). */
  to: string;
  kind: MessageKind;
  /** Texto já com as variáveis preenchidas (para provedores de texto livre e para o log). */
  text: string;
  variables: TemplateVariables;
  /** Conteúdo do botão "Confirmar" (lembrete), devolvido pelo provedor quando o paciente toca. */
  confirmPayload?: string;
  /** Resposta dentro de uma conversa aberta pelo paciente (texto livre permitido). */
  isReply?: boolean;
};

export type SendResult = { status: "sent" | "simulated"; providerId: string | null };

/** Interface única de envio. Trocar de provedor = implementar esta interface. */
export interface MessagingProvider {
  readonly name: string;
  send(message: OutgoingMessage): Promise<SendResult>;
}
