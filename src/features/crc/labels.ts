import type { Database } from "@/lib/supabase/database.types";

export type CrcQueue = Database["public"]["Enums"]["crc_queue"];
export type CrcChannel = Database["public"]["Enums"]["crc_channel"];
export type CrcOutcome = Database["public"]["Enums"]["crc_outcome"];

export const crcQueues: readonly CrcQueue[] = [
  "open_quotes",
  "untreated",
  "no_shows",
  "first_visit_no_shows",
  "overdue_returns",
  "overdue_payments",
  "birthdays",
];

export const queueLabels: Record<CrcQueue, string> = {
  open_quotes: "Orçamentos em aberto",
  untreated: "Tratamentos sem agendamento",
  no_shows: "Faltas",
  first_visit_no_shows: "Faltas na primeira consulta",
  overdue_returns: "Retornos vencidos",
  overdue_payments: "Inadimplentes",
  birthdays: "Aniversariantes",
};

export const queueDescriptions: Record<CrcQueue, string> = {
  open_quotes: "Orçamentos apresentados que ainda não foram aprovados nem recusados.",
  untreated: "Orçamento aprovado com itens a fazer e nenhuma consulta marcada.",
  no_shows: "Pacientes que faltaram nos últimos 90 dias e não remarcaram.",
  first_visit_no_shows: "Faltaram na primeira consulta e não remarcaram.",
  overdue_returns: "Alerta de retorno vencido sem consulta marcada.",
  overdue_payments: "Pacientes com parcelas vencidas.",
  birthdays: "Aniversário hoje e nos próximos 7 dias.",
};

export const outcomeLabels: Record<CrcOutcome, string> = {
  no_answer: "Não atendeu",
  thinking: "Vai pensar",
  scheduled: "Agendou",
  not_interested: "Sem interesse",
};

export const channelLabels: Record<CrcChannel, string> = {
  call: "Ligação",
  whatsapp: "WhatsApp",
  other: "Outro",
};
