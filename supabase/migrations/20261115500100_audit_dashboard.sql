-- Etapa 11: auditoria e indicadores do painel.
--
-- Auditoria (especificação): registra quem abriu ou alterou prontuário,
-- orçamento e financeiro. Alterações por gatilho; aberturas pela função
-- log_access, chamada pelo servidor ao abrir essas telas. Só owner/manager leem;
-- ninguém altera nem apaga.

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  user_id uuid references auth.users (id) on delete set null,
  -- view | insert | update | delete | export
  action text not null check (action in ('view', 'insert', 'update', 'delete', 'export')),
  table_name text not null,
  record_id uuid,
  patient_id uuid,
  at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index audit_log_clinic_at_idx on public.audit_log (clinic_id, at desc);
create index audit_log_patient_idx on public.audit_log (patient_id, at desc);

alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

create policy "auditoria: gestão lê" on public.audit_log for select to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')));

-- Alterações (gatilho genérico). Só registra ações de usuários logados.
create function public.audit_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _row jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  _patient uuid := nullif(_row ->> 'patient_id', '')::uuid;
begin
  if (select auth.uid()) is null then
    return null;
  end if;
  if _patient is null and tg_table_name = 'treatment_items' then
    select patient_id into _patient from public.treatment_plans where id = (_row ->> 'plan_id')::uuid;
  end if;
  insert into public.audit_log (clinic_id, user_id, action, table_name, record_id, patient_id)
  values ((_row ->> 'clinic_id')::uuid, (select auth.uid()), lower(tg_op), tg_table_name, (_row ->> 'id')::uuid, _patient);
  return null;
end;
$$;

revoke execute on function public.audit_changes() from public, anon, authenticated;

do $$
declare
  _table text;
begin
  foreach _table in array array[
    'anamneses', 'tooth_records', 'clinical_notes', 'patient_files',
    'treatment_plans', 'treatment_items', 'receivables', 'cash_movements'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function public.audit_changes()',
      _table || '_audit', _table
    );
  end loop;
end;
$$;

-- Aberturas e exportações (chamada pelo servidor, com a sessão do usuário).
create function public.log_access(_action text, _table_name text, _record_id uuid, _patient_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _clinic uuid := public.current_clinic_id();
begin
  if _clinic is null or _action not in ('view', 'export') then
    return;
  end if;
  if _table_name not in ('patients', 'anamneses', 'tooth_records', 'clinical_notes', 'patient_files', 'treatment_plans', 'receivables') then
    return;
  end if;
  -- O paciente precisa ser da clínica ativa (evita registrar acesso falso em outra clínica).
  if _patient_id is not null and not exists (select 1 from public.patients where id = _patient_id and clinic_id = _clinic) then
    return;
  end if;
  insert into public.audit_log (clinic_id, user_id, action, table_name, record_id, patient_id)
  values (_clinic, (select auth.uid()), _action, _table_name, _record_id, _patient_id);
end;
$$;

revoke execute on function public.log_access(text, text, uuid, uuid) from public, anon;
grant execute on function public.log_access(text, text, uuid, uuid) to authenticated;

-- Indicadores do painel ------------------------------------------------------------------
-- SECURITY INVOKER: cada número respeita a RLS de quem pede (dentista vê os próprios).
-- _unit_id nulo = consolidado (todas as unidades que o usuário pode ver).

create function public.dashboard_metrics(_unit_id uuid default null)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select
      public.today_sp() as today,
      (date_trunc('month', now() at time zone 'America/Sao_Paulo'))::date as month_start
  ),
  day_range as (
    select (b.today::timestamp at time zone 'America/Sao_Paulo') as from_ts,
           ((b.today + 1)::timestamp at time zone 'America/Sao_Paulo') as to_ts,
           (b.month_start::timestamp at time zone 'America/Sao_Paulo') as month_ts,
           ((b.today - 30)::timestamp at time zone 'America/Sao_Paulo') as last30_ts
    from bounds b
  )
  select jsonb_build_object(
    'appointments_today', (
      select count(*) from public.appointments a, day_range d
      where a.starts_at >= d.from_ts and a.starts_at < d.to_ts and a.status <> 'canceled'
        and (_unit_id is null or a.unit_id = _unit_id)
    ),
    'appointments_today_done', (
      select count(*) from public.appointments a, day_range d
      where a.starts_at >= d.from_ts and a.starts_at < d.to_ts and a.status in ('done', 'in_progress', 'arrived')
        and (_unit_id is null or a.unit_id = _unit_id)
    ),
    'revenue_month_cents', (
      select coalesce(sum(r.paid_amount_cents), 0) from public.receivables r, day_range d
      where r.status = 'paid' and r.paid_at >= d.month_ts and (_unit_id is null or r.unit_id = _unit_id)
    ),
    'receivable_open_cents', (
      select coalesce(sum(r.amount_cents), 0) from public.receivables r
      where r.status = 'open' and (_unit_id is null or r.unit_id = _unit_id)
    ),
    'receivable_overdue_cents', (
      select coalesce(sum(r.amount_cents), 0) from public.receivables r
      where r.status = 'overdue' and (_unit_id is null or r.unit_id = _unit_id)
    ),
    'open_plans', (
      select count(*) from public.treatment_plans p
      where p.status in ('draft', 'presented') and (_unit_id is null or p.unit_id = _unit_id)
    ),
    'open_plans_cents', (
      select coalesce(sum(p.total_cents), 0) from public.treatment_plans p
      where p.status in ('draft', 'presented') and (_unit_id is null or p.unit_id = _unit_id)
    ),
    'no_show_30d', (
      select count(*) from public.appointments a, day_range d
      where a.status = 'no_show' and a.starts_at >= d.last30_ts and a.starts_at < now()
        and (_unit_id is null or a.unit_id = _unit_id)
    ),
    'past_appointments_30d', (
      select count(*) from public.appointments a, day_range d
      where a.status <> 'canceled' and a.starts_at >= d.last30_ts and a.starts_at < now()
        and (_unit_id is null or a.unit_id = _unit_id)
    )
  );
$$;

revoke execute on function public.dashboard_metrics(uuid) from public, anon;
grant execute on function public.dashboard_metrics(uuid) to authenticated;
