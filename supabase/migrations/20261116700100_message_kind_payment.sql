-- Etapa 19: lembrete de cobrança (régua) entra como tipo de mensagem.
alter type public.message_kind add value if not exists 'payment_reminder';
