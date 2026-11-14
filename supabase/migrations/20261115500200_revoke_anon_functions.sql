-- Revisão de segurança (Etapa 11): nenhuma função pública fica executável sem login.
-- As listadas não acessam dados, mas não há motivo para expô-las ao papel anon.
revoke execute on function public.immutable_unaccent(text) from public, anon;
grant execute on function public.immutable_unaccent(text) to authenticated;

revoke execute on function public.today_sp() from public, anon;
grant execute on function public.today_sp() to authenticated;

-- Funções de gatilho: só o próprio gatilho as chama.
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.set_appointment_confirmed_at() from public, anon, authenticated;
revoke execute on function public.set_receivable_overdue_on_write() from public, anon, authenticated;
