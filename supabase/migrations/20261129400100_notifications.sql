-- Fase 3, P9: central de notificações e "novidades".
--
-- notifications: para uma pessoa (user_id) ou para todos com um dos papéis
-- (user_id nulo; roles nulo = todos os papéis). Como o aviso pode ser de várias
-- pessoas, a leitura fica em notification_reads (uma linha por pessoa), e não
-- numa coluna read_at única.
-- As notificações nascem de gatilhos nos eventos que já existem: agendamento
-- online, pedido de remarcação pelo portal, documento assinado, cobrança online
-- paga, prótese que voltou do laboratório, estoque abaixo do mínimo e lead do
-- formulário público.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  roles public.member_role[],
  kind text not null check (length(kind) <= 40),
  title text not null check (length(title) between 1 and 160),
  body text check (length(body) <= 500),
  link text check (link like '/%' and length(link) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notifications_clinic_idx on public.notifications (clinic_id, created_at desc);

create trigger notifications_set_updated_at
  before update on public.notifications
  for each row execute function public.set_updated_at();

create table public.notification_reads (
  notification_id uuid not null references public.notifications (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

create trigger notification_reads_set_updated_at
  before update on public.notification_reads
  for each row execute function public.set_updated_at();

-- A notificação é minha?
create function public.notification_is_mine(_user_id uuid, _roles public.member_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when _user_id is not null then _user_id = (select auth.uid())
    when _roles is null then true
    else exists (
      select 1 from public.clinic_members m
      where m.user_id = (select auth.uid()) and m.clinic_id = public.current_clinic_id() and m.active and m.role = any (_roles)
    )
  end;
$$;
revoke execute on function public.notification_is_mine(uuid, public.member_role[]) from public, anon;
grant execute on function public.notification_is_mine(uuid, public.member_role[]) to authenticated;

alter table public.notifications enable row level security;
alter table public.notification_reads enable row level security;
revoke all on public.notifications, public.notification_reads from anon, authenticated;
grant select on public.notifications to authenticated;
grant select, insert, delete on public.notification_reads to authenticated;

create policy "notificações: as minhas" on public.notifications for select to authenticated
  using (clinic_id = (select public.current_clinic_id()) and public.notification_is_mine(user_id, roles));

create policy "leituras: as minhas" on public.notification_reads for select to authenticated
  using (user_id = (select auth.uid()));
create policy "leituras: marco as minhas" on public.notification_reads for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and clinic_id = (select public.current_clinic_id())
    and exists (select 1 from public.notifications n where n.id = notification_id and n.clinic_id = clinic_id and public.notification_is_mine(n.user_id, n.roles))
  );
create policy "leituras: desmarco as minhas" on public.notification_reads for delete to authenticated
  using (user_id = (select auth.uid()));

alter publication supabase_realtime add table public.notifications;

-- Marcar todas como lidas.
create function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  _count integer;
begin
  insert into public.notification_reads (notification_id, user_id, clinic_id)
  select n.id, auth.uid(), n.clinic_id
  from public.notifications n
  where n.clinic_id = public.current_clinic_id()
    and public.notification_is_mine(n.user_id, n.roles)
    and not exists (select 1 from public.notification_reads r where r.notification_id = n.id and r.user_id = auth.uid())
  on conflict do nothing;
  get diagnostics _count = row_count;
  return _count;
end;
$$;
revoke execute on function public.mark_all_notifications_read() from public, anon;
grant execute on function public.mark_all_notifications_read() to authenticated;

-- Gerador interno (só os gatilhos chamam).
create function public.notify(_clinic_id uuid, _roles public.member_role[], _kind text, _title text, _body text, _link text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (clinic_id, roles, kind, title, body, link)
  values (_clinic_id, _roles, _kind, left(_title, 160), left(_body, 500), _link);
$$;
revoke execute on function public.notify(uuid, public.member_role[], text, text, text, text) from public, anon, authenticated;

create function public.patient_display_name(_patient_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select full_name from public.patients where id = _patient_id), 'Paciente');
$$;
revoke execute on function public.patient_display_name(uuid) from public, anon, authenticated;

-- Agendamento online novo e pedido de remarcação pelo portal.
create function public.notify_appointment_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _when text := to_char(new.starts_at at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI');
begin
  if tg_op = 'INSERT' and new.booked_online then
    perform public.notify(new.clinic_id, array['owner', 'manager', 'receptionist']::public.member_role[], 'online_booking',
      'Agendamento online: ' || public.patient_display_name(new.patient_id), 'Consulta marcada pelo site para ' || _when || '.',
      '/agenda?data=' || to_char(new.starts_at at time zone 'America/Sao_Paulo', 'YYYY-MM-DD'));
  elsif tg_op = 'UPDATE' and new.reschedule_requested_at is not null and old.reschedule_requested_at is null then
    perform public.notify(new.clinic_id, array['owner', 'manager', 'receptionist']::public.member_role[], 'reschedule_request',
      'Pedido de remarcação: ' || public.patient_display_name(new.patient_id), 'O paciente pediu pelo portal para remarcar a consulta de ' || _when || '.',
      '/agenda?data=' || to_char(new.starts_at at time zone 'America/Sao_Paulo', 'YYYY-MM-DD'));
  end if;
  return null;
end;
$$;
revoke execute on function public.notify_appointment_events() from public, anon, authenticated;
create trigger appointments_notify after insert or update of reschedule_requested_at on public.appointments
  for each row execute function public.notify_appointment_events();

-- Documento (ou anamnese) assinado.
create function public.notify_signature_signed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'signed' and old.status is distinct from 'signed' then
    perform public.notify(new.clinic_id, null, 'document_signed',
      case when new.purpose = 'anamnesis' then 'Anamnese assinada: ' else 'Documento assinado: ' end || public.patient_display_name(new.patient_id),
      coalesce(new.signer_name, 'O paciente') || ' assinou pelo link.',
      '/pacientes/' || new.patient_id || case when new.purpose = 'anamnesis' then '/anamnese' else '/documentos' end);
  end if;
  return null;
end;
$$;
revoke execute on function public.notify_signature_signed() from public, anon, authenticated;
create trigger signature_requests_notify after update of status on public.signature_requests
  for each row execute function public.notify_signature_signed();

-- Cobrança online paga.
create function public.notify_charge_paid()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'paid' and old.status is distinct from 'paid' then
    perform public.notify(new.clinic_id, array['owner', 'manager', 'receptionist']::public.member_role[], 'charge_paid',
      'Cobrança paga: ' || public.patient_display_name(new.patient_id),
      'R$ ' || to_char(coalesce(new.paid_cents, new.amount_cents) / 100.0, 'FM999G999G990D00') || ' recebidos online.',
      '/pacientes/' || new.patient_id || '/financeiro');
  end if;
  return null;
end;
$$;
revoke execute on function public.notify_charge_paid() from public, anon, authenticated;
create trigger patient_charges_notify after update of status on public.patient_charges
  for each row execute function public.notify_charge_paid();

-- Prótese que voltou do laboratório (saiu de "enviada").
create function public.notify_prosthetic_back()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.stage = 'sent' and new.stage in ('try_in', 'adjustment', 'ready') then
    perform public.notify(new.clinic_id, null, 'prosthetic_back',
      'Prótese voltou do laboratório: ' || public.patient_display_name(new.patient_id),
      new.work_type || '.', '/proteses');
  end if;
  return null;
end;
$$;
revoke execute on function public.notify_prosthetic_back() from public, anon, authenticated;
create trigger prosthetic_orders_notify after update of stage on public.prosthetic_orders
  for each row execute function public.notify_prosthetic_back();

-- Estoque abaixo do mínimo (quando o total do produto cruza o mínimo para baixo).
create function public.notify_stock_low()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _p public.stock_products;
  _total numeric;
  _before numeric;
begin
  if new.qty >= old.qty then
    return null;
  end if;
  select * into _p from public.stock_products where id = new.product_id;
  if _p.min_qty <= 0 then
    return null;
  end if;
  select coalesce(sum(qty), 0) into _total from public.stock_lots where product_id = new.product_id and clinic_id = new.clinic_id;
  _before := _total + (old.qty - new.qty);
  if _total < _p.min_qty and _before >= _p.min_qty then
    perform public.notify(new.clinic_id, array['owner', 'manager']::public.member_role[], 'stock_low',
      'Estoque baixo: ' || _p.name, 'Restam ' || trim(to_char(_total, 'FM999G990D###')) || ' ' || _p.measure || ' (mínimo ' || trim(to_char(_p.min_qty, 'FM999G990D###')) || ').', '/estoque');
  end if;
  return null;
end;
$$;
revoke execute on function public.notify_stock_low() from public, anon, authenticated;
create trigger stock_lots_notify after update of qty on public.stock_lots
  for each row execute function public.notify_stock_low();

-- Lead novo do formulário público.
create function public.notify_public_lead()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.from_public_form then
    perform public.notify(new.clinic_id, array['owner', 'manager', 'receptionist']::public.member_role[], 'public_lead',
      'Lead novo: ' || new.name, coalesce('Procura: ' || new.interest, 'Pelo formulário do site.'), '/crm');
  end if;
  return null;
end;
$$;
revoke execute on function public.notify_public_lead() from public, anon, authenticated;
create trigger leads_notify after insert on public.leads
  for each row execute function public.notify_public_lead();

-- Novidades: até quando a pessoa já viu.
alter table public.profiles add column news_seen_at timestamptz;
grant update (news_seen_at) on public.profiles to authenticated;

-- Notificações antigas saem depois de 90 dias.
select cron.schedule('limpar-notificacoes', '30 3 * * *', $$delete from public.notifications where created_at < now() - interval '90 days'$$);
