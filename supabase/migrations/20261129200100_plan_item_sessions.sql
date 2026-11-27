-- Fase 3, P6: sessões por procedimento do plano.
-- O item do orçamento diz quantas sessões leva (sessions_planned); cada sessão
-- feita é um registro (plan_item_sessions). Quando as sessões feitas chegam ao
-- total, o item vira realizado sozinho (ou continua sendo marcado à mão).
-- A consulta que inclui um item do plano (P1) fica ligada à próxima sessão:
-- a sessão nasce pendente (done_at nulo) e é dada como feita quando a consulta
-- fica "Atendido"; desmarcar ou faltar solta a sessão.

alter table public.treatment_items add column sessions_planned integer not null default 1 check (sessions_planned between 1 and 50);
grant insert (sessions_planned) on public.treatment_items to authenticated;
grant update (sessions_planned) on public.treatment_items to authenticated;

create table public.plan_item_sessions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  plan_item_id uuid not null,
  done_at timestamptz,
  appointment_id uuid,
  notes text check (length(notes) <= 500),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (plan_item_id, clinic_id) references public.treatment_items (id, clinic_id) on delete cascade,
  foreign key (appointment_id, clinic_id) references public.appointments (id, clinic_id) on delete set null (appointment_id)
);

create index plan_item_sessions_item_idx on public.plan_item_sessions (plan_item_id);
create index plan_item_sessions_appointment_idx on public.plan_item_sessions (appointment_id) where appointment_id is not null;

create trigger plan_item_sessions_set_updated_at
  before update on public.plan_item_sessions
  for each row execute function public.set_updated_at();

alter table public.plan_item_sessions enable row level security;
revoke all on public.plan_item_sessions from anon, authenticated;
grant select, delete on public.plan_item_sessions to authenticated;
grant insert (clinic_id, plan_item_id, done_at, notes) on public.plan_item_sessions to authenticated;

-- Mesma regra de "marcar realizado": dentista, owner ou manager.
create policy "sessões: membro lê" on public.plan_item_sessions for select to authenticated
  using (clinic_id = (select public.current_clinic_id()));
create policy "sessões: clínico registra" on public.plan_item_sessions for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager', 'dentist')) and done_at is not null);
create policy "sessões: clínico desfaz" on public.plan_item_sessions for delete to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager', 'dentist')));

create trigger plan_item_sessions_enforce_writable before insert or update or delete on public.plan_item_sessions
  for each row execute function public.enforce_clinic_writable();

-- Só itens aprovados (ou já feitos) recebem sessão.
create function public.check_plan_item_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _status public.treatment_item_status;
begin
  select status into _status from public.treatment_items where id = new.plan_item_id;
  if _status is null or _status not in ('approved', 'done') then
    raise exception 'Só procedimentos aprovados recebem sessões.' using errcode = 'OT010';
  end if;
  return new;
end;
$$;
revoke execute on function public.check_plan_item_session() from public, anon, authenticated;

create trigger plan_item_sessions_check
  before insert on public.plan_item_sessions
  for each row execute function public.check_plan_item_session();

-- Sessões feitas chegaram ao total: o item vira realizado.
create function public.complete_item_by_sessions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _planned integer;
  _done integer;
begin
  if new.done_at is null then
    return null;
  end if;
  select sessions_planned into _planned from public.treatment_items where id = new.plan_item_id;
  select count(*) into _done from public.plan_item_sessions where plan_item_id = new.plan_item_id and done_at is not null;
  if _done >= _planned then
    update public.treatment_items set status = 'done' where id = new.plan_item_id and status = 'approved';
  end if;
  return null;
end;
$$;
revoke execute on function public.complete_item_by_sessions() from public, anon, authenticated;

create trigger plan_item_sessions_complete
  after insert or update of done_at on public.plan_item_sessions
  for each row execute function public.complete_item_by_sessions();

-- Consulta com item do plano: reserva a próxima sessão (se ainda faltar alguma).
create function public.reserve_session_for_appointment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _planned integer;
  _status public.treatment_item_status;
  _used integer;
begin
  if new.treatment_item_id is null then
    return null;
  end if;
  select sessions_planned, status into _planned, _status from public.treatment_items where id = new.treatment_item_id;
  if _status is distinct from 'approved' then
    return null;
  end if;
  if exists (select 1 from public.plan_item_sessions where appointment_id = new.appointment_id and plan_item_id = new.treatment_item_id) then
    return null;
  end if;
  select count(*) into _used from public.plan_item_sessions where plan_item_id = new.treatment_item_id;
  if _used < _planned then
    insert into public.plan_item_sessions (clinic_id, plan_item_id, appointment_id, done_at, created_by)
    values (new.clinic_id, new.treatment_item_id, new.appointment_id, null, auth.uid());
  end if;
  return null;
end;
$$;
revoke execute on function public.reserve_session_for_appointment() from public, anon, authenticated;

create trigger appointment_procedures_reserve_session
  after insert on public.appointment_procedures
  for each row execute function public.reserve_session_for_appointment();

-- Item tirado da consulta: solta a sessão pendente.
create function public.release_session_for_procedure()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.treatment_item_id is not null then
    delete from public.plan_item_sessions
    where appointment_id = old.appointment_id and plan_item_id = old.treatment_item_id and done_at is null;
  end if;
  return null;
end;
$$;
revoke execute on function public.release_session_for_procedure() from public, anon, authenticated;

create trigger appointment_procedures_release_session
  after delete on public.appointment_procedures
  for each row execute function public.release_session_for_procedure();

-- Atendido: a sessão ligada conta como feita. Desmarcado/faltou: solta.
create function public.sessions_follow_appointment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.plan_item_sessions where appointment_id = old.id and done_at is null;
    return old;
  end if;
  if new.status is not distinct from old.status then
    return null;
  end if;
  if new.status = 'done' then
    update public.plan_item_sessions set done_at = now() where appointment_id = new.id and done_at is null;
  elsif new.status in ('canceled', 'no_show') then
    delete from public.plan_item_sessions where appointment_id = new.id and done_at is null;
  end if;
  return null;
end;
$$;
revoke execute on function public.sessions_follow_appointment() from public, anon, authenticated;

create trigger appointments_sessions_status
  after update of status on public.appointments
  for each row execute function public.sessions_follow_appointment();

create trigger appointments_sessions_delete
  before delete on public.appointments
  for each row execute function public.sessions_follow_appointment();
