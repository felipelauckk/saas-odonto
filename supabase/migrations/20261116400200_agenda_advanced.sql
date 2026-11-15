-- Etapa 15: agenda avançada — marcadores, primeira consulta, séries, lista de
-- espera, motivo de desmarcação, alerta de retorno e sala de espera.

create type public.cancel_reason as enum ('patient_canceled', 'clinic_canceled', 'rescheduled');
create type public.waitlist_period as enum ('any', 'morning', 'afternoon', 'evening');
create type public.waitlist_status as enum ('waiting', 'scheduled', 'removed');
create type public.return_status as enum ('pending', 'scheduled', 'done', 'dismissed');

-- Consultas: primeira consulta, série, desmarcação e chegada.
alter table public.appointments add column is_first_visit boolean not null default false;
alter table public.appointments add column series_id uuid;
alter table public.appointments add column cancel_reason public.cancel_reason;
alter table public.appointments add column cancel_note text check (length(cancel_note) <= 300);
alter table public.appointments add column arrived_at timestamptz;
alter table public.appointments add constraint appointments_id_clinic_key unique (id, clinic_id);
create index appointments_series_idx on public.appointments (series_id);
grant insert (series_id) on public.appointments to authenticated;
grant update (cancel_reason, cancel_note) on public.appointments to authenticated;

-- Primeira consulta: paciente sem nenhuma consulta realizada antes.
create function public.set_first_visit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.is_first_visit := not exists (
    select 1 from public.appointments a
    where a.patient_id = new.patient_id
      and a.id <> new.id
      and a.status in ('arrived', 'in_progress', 'done')
      and a.starts_at < new.starts_at
  );
  return new;
end;
$$;
revoke execute on function public.set_first_visit() from public, anon, authenticated;
create trigger appointments_first_visit before insert or update of starts_at, patient_id on public.appointments
  for each row execute function public.set_first_visit();

-- Chegada registra a hora; cancelar exige motivo (ações de usuário).
create function public.on_appointment_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'arrived' and old.status is distinct from 'arrived' and new.arrived_at is null then
    new.arrived_at := now();
  end if;
  if new.status in ('scheduled', 'confirmed') then
    new.arrived_at := null;
  end if;
  if new.status = 'canceled' and old.status is distinct from 'canceled' and new.cancel_reason is null and (select auth.uid()) is not null then
    raise exception 'Informe o motivo da desmarcação.' using errcode = 'OA001';
  end if;
  if new.status <> 'canceled' then
    new.cancel_reason := null;
    new.cancel_note := null;
  end if;
  return new;
end;
$$;
revoke execute on function public.on_appointment_status() from public, anon, authenticated;
create trigger appointments_status_side_effects before update of status on public.appointments
  for each row execute function public.on_appointment_status();

-- Marcadores ------------------------------------------------------------------------------

create table public.appointment_tags (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  name text not null check (length(trim(name)) > 0 and length(name) <= 40),
  color text not null default '#64748b' check (color ~ '^#[0-9a-fA-F]{6}$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, clinic_id),
  unique (clinic_id, name)
);

create table public.appointment_tag_links (
  appointment_id uuid not null,
  tag_id uuid not null,
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (appointment_id, tag_id),
  foreign key (appointment_id, clinic_id) references public.appointments (id, clinic_id) on delete cascade,
  foreign key (tag_id, clinic_id) references public.appointment_tags (id, clinic_id) on delete cascade
);
create index appointment_tag_links_tag_idx on public.appointment_tag_links (tag_id);

-- Lista de espera -----------------------------------------------------------------------------

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  unit_id uuid not null,
  patient_id uuid not null,
  professional_id uuid,
  period public.waitlist_period not null default 'any',
  notes text check (length(notes) <= 300),
  status public.waitlist_status not null default 'waiting',
  appointment_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (unit_id, clinic_id) references public.units (id, clinic_id) on delete restrict,
  foreign key (patient_id, clinic_id) references public.patients (id, clinic_id) on delete restrict,
  foreign key (professional_id, clinic_id) references public.professionals (id, clinic_id) on delete restrict,
  foreign key (appointment_id, clinic_id) references public.appointments (id, clinic_id) on delete set null (appointment_id)
);
create index waitlist_clinic_status_idx on public.waitlist (clinic_id, status);

-- Alerta de retorno ---------------------------------------------------------------------------

alter table public.procedures add column return_months smallint check (return_months between 1 and 60);
grant insert (return_months) on public.procedures to authenticated;
grant update (return_months) on public.procedures to authenticated;
update public.procedures set return_months = 6 where name in ('Profilaxia (limpeza)', 'Aplicação de flúor', 'Raspagem e alisamento radicular (por quadrante)');
update public.procedures set return_months = 1 where name = 'Manutenção ortodôntica';
update public.procedures set return_months = 12 where name in ('Consulta de avaliação', 'Implante dentário', 'Coroa sobre implante');

create table public.patient_returns (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  patient_id uuid not null,
  professional_id uuid,
  procedure_id uuid,
  reason text not null check (length(trim(reason)) > 0 and length(reason) <= 160),
  due_date date not null,
  status public.return_status not null default 'pending',
  source_appointment_id uuid,
  scheduled_appointment_id uuid,
  notified_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (patient_id, clinic_id) references public.patients (id, clinic_id) on delete restrict,
  foreign key (professional_id, clinic_id) references public.professionals (id, clinic_id) on delete restrict,
  foreign key (procedure_id, clinic_id) references public.procedures (id, clinic_id) on delete set null (procedure_id),
  foreign key (source_appointment_id, clinic_id) references public.appointments (id, clinic_id) on delete set null (source_appointment_id),
  foreign key (scheduled_appointment_id, clinic_id) references public.appointments (id, clinic_id) on delete set null (scheduled_appointment_id)
);
create index patient_returns_due_idx on public.patient_returns (clinic_id, status, due_date);

-- Retorno sai da lista quando o paciente marca uma nova consulta depois de pendente.
create function public.link_return_on_new_appointment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.patient_returns
     set status = 'scheduled', scheduled_appointment_id = new.id
   where patient_id = new.patient_id
     and status = 'pending'
     and new.status not in ('canceled', 'no_show')
     and new.starts_at > now();
  return null;
end;
$$;
revoke execute on function public.link_return_on_new_appointment() from public, anon, authenticated;
create trigger appointments_link_return after insert on public.appointments
  for each row execute function public.link_return_on_new_appointment();

-- Gatilhos padrão nas tabelas novas.
do $$
declare
  _table text;
begin
  foreach _table in array array['appointment_tags', 'appointment_tag_links', 'waitlist', 'patient_returns'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', _table || '_set_updated_at', _table);
    execute format('create trigger %I before insert or update or delete on public.%I for each row execute function public.enforce_clinic_writable()', _table || '_enforce_writable', _table);
  end loop;
end;
$$;

-- Permissões --------------------------------------------------------------------------------

alter table public.appointment_tags enable row level security;
alter table public.appointment_tag_links enable row level security;
alter table public.waitlist enable row level security;
alter table public.patient_returns enable row level security;
revoke all on public.appointment_tags, public.appointment_tag_links, public.waitlist, public.patient_returns from anon, authenticated;

grant select on public.appointment_tags to authenticated;
grant insert (clinic_id, name, color, active) on public.appointment_tags to authenticated;
grant update (name, color, active) on public.appointment_tags to authenticated;
create policy "marcadores: membro lê" on public.appointment_tags for select to authenticated using (clinic_id = (select public.current_clinic_id()));
create policy "marcadores: gestão cria" on public.appointment_tags for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')));
create policy "marcadores: gestão edita" on public.appointment_tags for update to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')))
  with check (clinic_id = (select public.current_clinic_id()));

-- Vínculo segue a permissão da consulta (quem vê e mexe na consulta, marca).
grant select, insert, delete on public.appointment_tag_links to authenticated;
create policy "marcadores da consulta: lê" on public.appointment_tag_links for select to authenticated
  using (clinic_id = (select public.current_clinic_id()) and exists (select 1 from public.appointments a where a.id = appointment_id));
create policy "marcadores da consulta: marca" on public.appointment_tag_links for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and exists (select 1 from public.appointments a where a.id = appointment_id));
create policy "marcadores da consulta: desmarca" on public.appointment_tag_links for delete to authenticated
  using (clinic_id = (select public.current_clinic_id()) and exists (select 1 from public.appointments a where a.id = appointment_id));

grant select on public.waitlist, public.patient_returns to authenticated;
grant insert (clinic_id, unit_id, patient_id, professional_id, period, notes, created_by) on public.waitlist to authenticated;
grant update (professional_id, period, notes, status, appointment_id) on public.waitlist to authenticated;
grant insert (clinic_id, patient_id, professional_id, procedure_id, reason, due_date, source_appointment_id, created_by) on public.patient_returns to authenticated;
grant update (due_date, status, scheduled_appointment_id) on public.patient_returns to authenticated;

create policy "espera: membro lê" on public.waitlist for select to authenticated
  using (clinic_id = (select public.current_clinic_id()) and public.can_access_unit(unit_id));
create policy "espera: membro inclui" on public.waitlist for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and public.can_access_unit(unit_id));
create policy "espera: membro edita" on public.waitlist for update to authenticated
  using (clinic_id = (select public.current_clinic_id()) and public.can_access_unit(unit_id))
  with check (clinic_id = (select public.current_clinic_id()));

create policy "retornos: membro lê" on public.patient_returns for select to authenticated using (clinic_id = (select public.current_clinic_id()));
create policy "retornos: membro cria" on public.patient_returns for insert to authenticated with check (clinic_id = (select public.current_clinic_id()));
create policy "retornos: membro edita" on public.patient_returns for update to authenticated
  using (clinic_id = (select public.current_clinic_id())) with check (clinic_id = (select public.current_clinic_id()));

-- Dados iniciais -------------------------------------------------------------------------------

create function public.seed_agenda_defaults(_clinic_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.appointment_tags (clinic_id, name, color) values
    (_clinic_id, 'Avaliação', '#2563eb'),
    (_clinic_id, 'Urgência', '#dc2626'),
    (_clinic_id, 'Retorno', '#16a34a'),
    (_clinic_id, 'Manutenção ortodôntica', '#7c3aed')
  on conflict (clinic_id, name) do nothing;
  insert into public.message_templates (clinic_id, kind, body) values
    (_clinic_id, 'return_reminder', 'Olá, {{paciente}}! Está na hora do seu retorno na {{clinica}}. Responda esta mensagem para marcarmos um horário.')
  on conflict (clinic_id, kind) do nothing;
$$;
revoke execute on function public.seed_agenda_defaults(uuid) from public, anon, authenticated;

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
  return null;
end;
$$;

select public.seed_agenda_defaults(id) from public.clinics;

-- Tempo real também para a sala de espera e lista de espera.
alter publication supabase_realtime add table public.waitlist;
