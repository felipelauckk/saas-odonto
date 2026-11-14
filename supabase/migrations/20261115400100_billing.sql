-- Etapa 10: assinatura do SaaS (Asaas), modo só leitura e superadmin.
--
--  * Só leitura quando: teste vencido sem assinatura, atraso há mais de 7 dias
--    ou assinatura cancelada. Imposto por gatilho em todas as tabelas da clínica
--    (vale para usuários logados; servidor/cron com service role passam).
--  * Limites do plano (unidades, profissionais) valem quando a clínica tem plano.
--  * Superadmin (platform_admins) só é lido pelo servidor; nunca vê pacientes.

alter table public.clinics add column past_due_since timestamptz;
alter table public.clinics add column canceled_at timestamptz;

-- Superadmin -------------------------------------------------------------------------

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon, authenticated;

create function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()));
$$;

revoke execute on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

-- Eventos de cobrança recebidos (idempotência e auditoria do webhook) ----------------------

create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics (id) on delete set null,
  provider text not null default 'asaas',
  event_id text not null,
  event text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, event_id)
);
alter table public.billing_events enable row level security;
revoke all on public.billing_events from anon, authenticated;

-- Situação da assinatura -------------------------------------------------------------------

create function public.clinic_access_state(_clinic_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when c.subscription_status = 'active' then 'ok'
    when c.subscription_status = 'trialing' and (c.trial_ends_at is null or c.trial_ends_at > now()) then 'ok'
    when c.subscription_status = 'past_due' and coalesce(c.past_due_since, now()) > now() - interval '7 days' then 'grace'
    else 'read_only'
  end
  from public.clinics c
  where c.id = _clinic_id;
$$;

revoke execute on function public.clinic_access_state(uuid) from public, anon;
grant execute on function public.clinic_access_state(uuid) to authenticated;

create function public.clinic_writable(_clinic_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.clinic_access_state(coalesce(_clinic_id, public.current_clinic_id())), 'ok') <> 'read_only';
$$;

revoke execute on function public.clinic_writable(uuid) from public, anon;
grant execute on function public.clinic_writable(uuid) to authenticated;

-- Gatilho genérico: recusa escrita de usuário logado em clínica só leitura (SQLSTATE OS001).
create function public.enforce_clinic_writable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _clinic uuid := case when tg_op = 'DELETE' then old.clinic_id else new.clinic_id end;
begin
  if (select auth.uid()) is not null and not public.clinic_writable(_clinic) then
    raise exception 'Assinatura inativa: a clínica está em modo somente leitura. Regularize em Configurações → Assinatura.'
      using errcode = 'OS001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke execute on function public.enforce_clinic_writable() from public, anon, authenticated;

do $$
declare
  _table text;
begin
  foreach _table in array array[
    'units', 'clinic_members', 'professionals', 'chairs', 'professional_schedules', 'procedures',
    'payment_methods', 'anamnesis_templates', 'patients', 'appointments', 'schedule_blocks',
    'anamneses', 'tooth_records', 'clinical_notes', 'patient_files', 'treatment_plans',
    'treatment_items', 'receivables', 'cash_movements', 'message_templates'
  ] loop
    execute format(
      'create trigger %I before insert or update or delete on public.%I
         for each row execute function public.enforce_clinic_writable()',
      _table || '_enforce_writable', _table
    );
  end loop;
end;
$$;

-- Arquivos (logo e clínicos) também respeitam o modo só leitura.
alter policy "owner e manager enviam o logo" on storage.objects
  with check (
    bucket_id = 'clinic'
    and (storage.foldername(name))[1] = (select public.current_clinic_id())::text
    and (storage.foldername(name))[2] = 'logo'
    and (select public.has_role('owner', 'manager'))
    and (select public.clinic_writable())
  );

alter policy "prontuário: enviar arquivos clínicos" on storage.objects
  with check (
    bucket_id = 'clinic'
    and (storage.foldername(name))[1] = (select public.current_clinic_id())::text
    and (storage.foldername(name))[2] = 'patients'
    and (select public.can_write_clinical())
    and (select public.clinic_writable())
  );

-- Limites do plano (SQLSTATE OS002) ---------------------------------------------------------

create function public.enforce_plan_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _limit integer;
  _count integer;
begin
  if (select auth.uid()) is null or not new.active then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.active then
    return new; -- só conta quando algo passa a ficar ativo
  end if;

  if tg_table_name = 'units' then
    select p.max_units into _limit from public.clinics c join public.plans p on p.id = c.plan_id where c.id = new.clinic_id;
    select count(*) into _count from public.units where clinic_id = new.clinic_id and active and id <> new.id;
  else
    select p.max_professionals into _limit from public.clinics c join public.plans p on p.id = c.plan_id where c.id = new.clinic_id;
    select count(*) into _count from public.professionals where clinic_id = new.clinic_id and active and id <> new.id;
  end if;

  if _limit is not null and _count >= _limit then
    raise exception 'Seu plano permite até % %. Mude de plano em Configurações → Assinatura.',
      _limit, case when tg_table_name = 'units' then 'unidades ativas' else 'profissionais ativos' end
      using errcode = 'OS002';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_plan_limits() from public, anon, authenticated;

create trigger units_plan_limit before insert or update of active on public.units
  for each row execute function public.enforce_plan_limits();
create trigger professionals_plan_limit before insert or update of active on public.professionals
  for each row execute function public.enforce_plan_limits();
