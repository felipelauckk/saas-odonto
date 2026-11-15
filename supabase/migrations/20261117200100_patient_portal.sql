-- Etapa 24: agendamento online, check-in por QR Code e portal do paciente.
--
--  * Agendamento online: configuração por clínica (endereço público pelo
--    slug, profissionais e tipos de consulta oferecidos, antecedência). O
--    paciente confirma com um código enviado pelo WhatsApp (só o hash fica no
--    banco). A página pública fala com o banco pelo servidor (service role).
--  * Check-in: cada unidade tem um token para o QR Code da recepção.
--  * Portal: link mágico por paciente (só o hash fica no banco), válido por
--    30 dias e revogável. Tudo do portal passa pelo servidor.

-- Agendamento online --------------------------------------------------------------------------------

create table public.online_booking_settings (
  clinic_id uuid primary key references public.clinics (id) on delete restrict,
  enabled boolean not null default false,
  slug text not null unique check (slug ~ '^[a-z0-9](-?[a-z0-9])*$' and length(slug) between 3 and 60),
  intro text check (length(intro) <= 500),
  professional_ids uuid[] not null default '{}',
  procedure_ids uuid[] not null default '{}',
  default_duration_min smallint not null default 30 check (default_duration_min between 10 and 240),
  min_notice_hours smallint not null default 2 check (min_notice_hours between 0 and 168),
  max_days_ahead smallint not null default 30 check (max_days_ahead between 1 and 180),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  phone text not null check (phone ~ '^\d{10,11}$'),
  code_hash text not null,
  payload jsonb not null,
  attempts smallint not null default 0,
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  appointment_id uuid references public.appointments (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index booking_requests_phone_idx on public.booking_requests (clinic_id, phone, created_at desc);

-- Check-in e pedido de remarcação -------------------------------------------------------------------

alter table public.units add column checkin_token text not null default replace(gen_random_uuid()::text, '-', '');
create unique index units_checkin_token_key on public.units (checkin_token);
alter table public.appointments add column reschedule_requested_at timestamptz;
alter table public.appointments add column booked_online boolean not null default false;
grant update (reschedule_requested_at) on public.appointments to authenticated;

-- Portal do paciente -----------------------------------------------------------------------------------

create table public.portal_links (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  patient_id uuid not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (patient_id, clinic_id) references public.patients (id, clinic_id) on delete restrict
);
create index portal_links_patient_idx on public.portal_links (patient_id);

do $$
declare
  _table text;
begin
  foreach _table in array array['online_booking_settings', 'booking_requests', 'portal_links'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', _table || '_set_updated_at', _table);
  end loop;
  foreach _table in array array['online_booking_settings', 'portal_links'] loop
    execute format('create trigger %I before insert or update or delete on public.%I for each row execute function public.enforce_clinic_writable()', _table || '_enforce_writable', _table);
  end loop;
end;
$$;

alter table public.online_booking_settings enable row level security;
alter table public.booking_requests enable row level security;
alter table public.portal_links enable row level security;
revoke all on public.online_booking_settings, public.booking_requests, public.portal_links from anon, authenticated;

grant select on public.online_booking_settings to authenticated;
grant insert (clinic_id, enabled, slug, intro, professional_ids, procedure_ids, default_duration_min, min_notice_hours, max_days_ahead) on public.online_booking_settings to authenticated;
grant update (enabled, slug, intro, professional_ids, procedure_ids, default_duration_min, min_notice_hours, max_days_ahead) on public.online_booking_settings to authenticated;
create policy "agendamento online: membro lê" on public.online_booking_settings for select to authenticated
  using (clinic_id = (select public.current_clinic_id()));
create policy "agendamento online: gestão cria" on public.online_booking_settings for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')));
create policy "agendamento online: gestão edita" on public.online_booking_settings for update to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')))
  with check (clinic_id = (select public.current_clinic_id()));
-- booking_requests: só o servidor (sem permissões para o app).

-- O hash do token nunca é legível pelo app.
grant select (id, clinic_id, patient_id, expires_at, revoked_at, last_used_at, created_by, created_at) on public.portal_links to authenticated;
grant insert (clinic_id, patient_id, token_hash, expires_at, created_by) on public.portal_links to authenticated;
grant update (revoked_at) on public.portal_links to authenticated;
create policy "portal: recepção e gestão leem" on public.portal_links for select to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.can_use_crc()));
create policy "portal: recepção e gestão criam" on public.portal_links for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and (select public.can_use_crc()) and created_by = (select auth.uid()));
create policy "portal: recepção e gestão revogam" on public.portal_links for update to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.can_use_crc()))
  with check (clinic_id = (select public.current_clinic_id()));

-- Aprovação de orçamento: núcleo comum (recepção e portal) --------------------------------------------

create function public.approve_plan_core(_plan_id uuid, _item_ids uuid[], _discount_cents integer, _installments integer,
                                         _first_due_date date, _payment_method_id uuid, _actor uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _plan public.treatment_plans;
  _approved_total integer;
  _net integer;
  _base integer;
  _remainder integer;
  _all_count integer;
  _patient_name text;
  i integer;
begin
  select * into _plan from public.treatment_plans where id = _plan_id for update;
  if not found then
    raise exception 'Orçamento não encontrado.' using errcode = 'P0002';
  end if;
  if _plan.status not in ('draft', 'presented') then
    raise exception 'Este orçamento já foi decidido.' using errcode = 'OT003';
  end if;
  if coalesce(array_length(_item_ids, 1), 0) = 0 then
    raise exception 'Escolha pelo menos um item para aprovar.' using errcode = 'OT004';
  end if;
  if _installments not between 1 and 48 then
    raise exception 'Número de parcelas inválido.' using errcode = 'OT005';
  end if;
  if _payment_method_id is not null and not exists (
    select 1 from public.payment_methods where id = _payment_method_id and clinic_id = _plan.clinic_id
  ) then
    raise exception 'Forma de pagamento inválida.' using errcode = 'OT006';
  end if;

  update public.treatment_items
     set status = case when id = any (_item_ids) then 'approved'::public.treatment_item_status
                       else 'rejected'::public.treatment_item_status end
   where plan_id = _plan_id;

  select coalesce(sum(price_cents), 0), (select count(*) from public.treatment_items where plan_id = _plan_id)
    into _approved_total, _all_count
    from public.treatment_items
   where plan_id = _plan_id and status = 'approved';

  if _discount_cents < 0 or _discount_cents > _approved_total then
    raise exception 'Desconto maior que o valor aprovado.' using errcode = 'OT007';
  end if;

  _net := _approved_total - _discount_cents;

  update public.treatment_plans
     set status = case when array_length(_item_ids, 1) >= _all_count then 'approved'::public.treatment_plan_status
                       else 'partially_approved'::public.treatment_plan_status end,
         discount_cents = _discount_cents,
         installments = _installments,
         first_due_date = _first_due_date,
         payment_method_id = _payment_method_id,
         approved_at = now(),
         approved_by = _actor
   where id = _plan_id;

  if _net > 0 then
    select full_name into _patient_name from public.patients where id = _plan.patient_id;
    _base := _net / _installments;
    _remainder := _net - _base * _installments;
    for i in 1.._installments loop
      insert into public.receivables (
        clinic_id, unit_id, patient_id, plan_id, professional_id, description,
        amount_cents, due_date, installment_number, installment_total, payment_method_id, created_by
      ) values (
        _plan.clinic_id, _plan.unit_id, _plan.patient_id, _plan_id, _plan.professional_id,
        'Orçamento ' || _patient_name || case when _installments > 1 then ' (' || i || '/' || _installments || ')' else '' end,
        _base + case when i = 1 then _remainder else 0 end,
        (_first_due_date + make_interval(months => i - 1))::date,
        i, _installments, _payment_method_id, _actor
      );
    end loop;
  end if;
end;
$$;
revoke execute on function public.approve_plan_core(uuid, uuid[], integer, integer, date, uuid, uuid) from public, anon, authenticated;

create or replace function public.approve_treatment_plan(
  _plan_id uuid,
  _item_ids uuid[],
  _discount_cents integer,
  _installments integer,
  _first_due_date date,
  _payment_method_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _plan public.treatment_plans;
begin
  select * into _plan from public.treatment_plans where id = _plan_id and clinic_id = public.current_clinic_id();
  if not found then
    raise exception 'Orçamento não encontrado.' using errcode = 'P0002';
  end if;
  if not public.can_access_unit(_plan.unit_id) then
    raise exception 'Sem acesso a esta unidade.' using errcode = '42501';
  end if;
  perform public.approve_plan_core(_plan_id, _item_ids, _discount_cents, _installments, _first_due_date, _payment_method_id, (select auth.uid()));
end;
$$;

-- Portal: o paciente aprova o orçamento apresentado inteiro, nas condições
-- que a clínica deixou no orçamento (parcelas e desconto). Só o servidor chama.
create function public.portal_approve_plan(_plan_id uuid, _patient_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _plan public.treatment_plans;
  _items uuid[];
begin
  select * into _plan from public.treatment_plans where id = _plan_id and patient_id = _patient_id;
  if not found or _plan.status <> 'presented' then
    raise exception 'Este orçamento não está disponível para aprovação.' using errcode = 'OT003';
  end if;
  select array_agg(id) into _items from public.treatment_items where plan_id = _plan_id;
  perform public.approve_plan_core(_plan_id, _items, _plan.discount_cents, greatest(_plan.installments, 1),
                                   coalesce(_plan.first_due_date, public.today_sp() + 7), _plan.payment_method_id, null);
end;
$$;
revoke execute on function public.portal_approve_plan(uuid, uuid) from public, anon, authenticated;

-- Configuração padrão: endereço a partir do nome da clínica (desligado até a clínica ativar).
create function public.seed_booking_defaults(_clinic_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _base text;
begin
  select trim(both '-' from regexp_replace(lower(translate(name, 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn')), '[^a-z0-9]+', '-', 'g'))
    into _base from public.clinics where id = _clinic_id;
  _base := left(coalesce(nullif(_base, ''), 'clinica'), 48);
  if length(_base) < 3 then
    _base := _base || '-clinica';
  end if;
  insert into public.online_booking_settings (clinic_id, slug)
  values (_clinic_id, _base || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
  on conflict (clinic_id) do nothing;
end;
$$;
revoke execute on function public.seed_booking_defaults(uuid) from public, anon, authenticated;

create or replace function public.on_clinic_created_seed_documents()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_document_defaults(new.id);
  perform public.seed_finance_defaults(new.id);
  perform public.seed_agenda_defaults(new.id);
  perform public.seed_crc_defaults(new.id);
  perform public.seed_crm_defaults(new.id);
  perform public.seed_dunning_defaults(new.id);
  perform public.seed_specialty_defaults(new.id);
  perform public.seed_booking_defaults(new.id);
  return null;
end;
$$;

-- Clínicas existentes (ignora uma clínica apagada enquanto a migration roda).
do $$
declare
  _id uuid;
begin
  for _id in select id from public.clinics loop
    begin
      perform public.seed_booking_defaults(_id);
    exception when foreign_key_violation then
      null;
    end;
  end loop;
end;
$$;
