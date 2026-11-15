-- Etapa 15: novo tipo de mensagem (alerta de retorno). Em migration própria
-- porque o valor novo de um enum não pode ser usado na mesma transação.
alter type public.message_kind add value if not exists 'return_reminder';
