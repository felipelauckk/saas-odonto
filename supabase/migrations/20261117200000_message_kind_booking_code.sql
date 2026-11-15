-- Etapa 24: código de confirmação do agendamento online pelo WhatsApp.
alter type public.message_kind add value if not exists 'booking_code';
