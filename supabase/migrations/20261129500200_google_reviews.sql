-- Fase 3, P10: avaliações no Google, primeira versão sem a API.
-- A gestão informa o link de avaliação da clínica (Configurações > Clínica) e
-- quantas horas depois do "Atendido" sai o pedido (modelo review_request, que
-- nasce desligado). A leitura das avaliações pela API do Google Business
-- Profile fica para depois (exige aprovação do Google).

alter table public.clinics
  add column google_review_url text check (google_review_url ~ '^https://[^\s]{8,400}$'),
  add column review_request_delay_hours integer not null default 2 check (review_request_delay_hours between 1 and 72);

grant update (google_review_url, review_request_delay_hours) on public.clinics to authenticated;

alter table public.appointments add column review_requested_at timestamptz;

-- Modelo do pedido: desligado até a clínica ligar.
create function public.seed_review_template(_clinic_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.message_templates (clinic_id, kind, body, active)
  values (_clinic_id, 'review_request',
    'Olá, {{paciente}}! Obrigado por vir à {{clinica}}. Se puder, conte como foi o atendimento no Google: {{link}}', false)
  on conflict (clinic_id, kind) do nothing;
$$;
revoke execute on function public.seed_review_template(uuid) from public, anon, authenticated;

create function public.on_clinic_created_seed_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_review_template(new.id);
  return new;
end;
$$;
revoke execute on function public.on_clinic_created_seed_review() from public, anon, authenticated;

create trigger clinics_seed_review_template
  after insert on public.clinics
  for each row execute function public.on_clinic_created_seed_review();

select public.seed_review_template(id) from public.clinics;
