-- Fase 3, P10: tipo de mensagem "pedido de avaliação no Google". Arquivo
-- separado porque o valor novo do enum só pode ser usado depois do commit.
alter type public.message_kind add value if not exists 'review_request';
