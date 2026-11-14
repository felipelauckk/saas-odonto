-- Etapa 5: agenda (consultas e bloqueios de horário).
--
-- Regras:
--  * O mesmo profissional não tem duas consultas ao mesmo tempo; a mesma
--    cadeira também não. Consultas canceladas ou com falta liberam o horário.
--  * Horário bloqueado (da unidade toda ou de um profissional) recusa consultas.
--  * Owner/manager veem tudo; recepção vê as unidades permitidas; dentista vê
--    só a própria agenda (profissional ligado ao seu usuário).
--  * Consulta não é apagada: é cancelada (status).

create type public.appointment_status as enum (
  'scheduled', 'confirmed', 'arrived', 'in_progress', 'done', 'no_show', 'canceled'
);

alter table public.patients add constraint patients_id_clinic_key unique (id, clinic_id);
alter table public.chairs add constraint chairs_id_clinic_key unique (id, clinic_id);

-- Consultas ----------------------------------------------------------------------

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  unit_id uuid not null,
  patient_id uuid not null,
  professional_id uuid not null,
  chair_id uuid,
  procedure_id uuid references public.procedures (id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'scheduled',
  -- Texto livre curto: "Avaliação", "Retorno", nome do procedimento...
  type text check (length(type) <= 120),
  notes text check (length(notes) <= 2000),
  reminder_sent_at timestamptz,
  confirmed_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at and ends_at - starts_at <= interval '12 hours'),
  foreign key (unit_id, clinic_id) references public.units (id, clinic_id) on delete restrict,
  foreign key (patient_id, clinic_id) references public.patients (id, clinic_id) on delete restrict,
  foreign key (professional_id, clinic_id) references public.professionals (id, clinic_id) on delete restrict,
  foreign key (chair_id, clinic_id) references public.chairs (id, clinic_id) on delete restrict,
  constraint appointments_professional_no_overlap exclude using gist (
    professional_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status not in ('canceled', 'no_show')),
  constraint appointments_chair_no_overlap exclude using gist (
    chair_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (chair_id is not null and status not in ('canceled', 'no_show'))
);

create index appointments_clinic_starts_idx on public.appointments (clinic_id, starts_at);
create index appointments_unit_starts_idx on public.appointments (unit_id, starts_at);
create index appointments_patient_idx on public.appointments (patient_id, starts_at desc);
create index appointments_professional_starts_idx on public.appointments (professional_id, starts_at);

create trigger appointments_set_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

-- Bloqueios de horário --------------------------------------------------------------

create table public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  unit_id uuid not null,
  -- Null = a unidade toda (feriado, reforma...).
  professional_id uuid,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text check (length(reason) <= 200),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  foreign key (unit_id, clinic_id) references public.units (id, clinic_id) on delete restrict,
  foreign key (professional_id, clinic_id) references public.professionals (id, clinic_id) on delete restrict
);

create index schedule_blocks_unit_starts_idx on public.schedule_blocks (unit_id, starts_at);

create trigger schedule_blocks_set_updated_at
  before update on public.schedule_blocks
  for each row execute function public.set_updated_at();

-- Consulta em horário bloqueado é recusada (SQLSTATE OB001).
create function public.check_appointment_not_blocked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _reason text;
begin
  if new.status in ('canceled', 'no_show') then
    return new;
  end if;

  select coalesce(nullif(b.reason, ''), 'horário bloqueado') into _reason
  from public.schedule_blocks b
  where b.unit_id = new.unit_id
    and (b.professional_id is null or b.professional_id = new.professional_id)
    and tstzrange(b.starts_at, b.ends_at) && tstzrange(new.starts_at, new.ends_at)
  limit 1;

  if found then
    raise exception 'Horário bloqueado: %', _reason using errcode = 'OB001';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_appointment_not_blocked() from public, anon, authenticated;

create trigger appointments_check_block
  before insert or update of starts_at, ends_at, professional_id, unit_id, status on public.appointments
  for each row execute function public.check_appointment_not_blocked();

-- Confirmação registra a hora.
create function public.set_appointment_confirmed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'confirmed' and (tg_op = 'INSERT' or old.status is distinct from 'confirmed') then
    new.confirmed_at = coalesce(new.confirmed_at, now());
  end if;
  return new;
end;
$$;

create trigger appointments_confirmed_at
  before insert or update of status on public.appointments
  for each row execute function public.set_appointment_confirmed_at();

-- Quem vê a agenda de quem ------------------------------------------------------------

-- Profissionais ligados ao usuário logado na clínica ativa.
create function public.current_professional_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.professionals p
  join public.clinic_members m on m.id = p.member_id
  where m.user_id = (select auth.uid())
    and m.clinic_id = public.current_clinic_id()
    and m.active;
$$;

-- Pode ver/mexer na agenda desta unidade e deste profissional?
create function public.can_access_agenda(_unit_id uuid, _professional_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_access_unit(_unit_id)
    and (
      not public.has_role('dentist')
      or _professional_id in (select public.current_professional_ids())
    );
$$;

revoke execute on function public.current_professional_ids() from public, anon;
revoke execute on function public.can_access_agenda(uuid, uuid) from public, anon;
grant execute on function public.current_professional_ids() to authenticated;
grant execute on function public.can_access_agenda(uuid, uuid) to authenticated;

-- Permissões -----------------------------------------------------------------------

alter table public.appointments enable row level security;
alter table public.schedule_blocks enable row level security;

revoke all on public.appointments, public.schedule_blocks from anon, authenticated;

grant select on public.appointments to authenticated;
grant insert (
  clinic_id, unit_id, patient_id, professional_id, chair_id, procedure_id,
  starts_at, ends_at, status, type, notes, created_by
) on public.appointments to authenticated;
grant update (
  unit_id, professional_id, chair_id, procedure_id, starts_at, ends_at, status, type, notes
) on public.appointments to authenticated;

grant select, delete on public.schedule_blocks to authenticated;
grant insert (clinic_id, unit_id, professional_id, starts_at, ends_at, reason, created_by)
  on public.schedule_blocks to authenticated;

create policy "agenda: ler consultas permitidas"
  on public.appointments for select to authenticated
  using (clinic_id = (select public.current_clinic_id()) and public.can_access_agenda(unit_id, professional_id));

create policy "agenda: criar consultas permitidas"
  on public.appointments for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and public.can_access_agenda(unit_id, professional_id));

create policy "agenda: alterar consultas permitidas"
  on public.appointments for update to authenticated
  using (clinic_id = (select public.current_clinic_id()) and public.can_access_agenda(unit_id, professional_id))
  with check (clinic_id = (select public.current_clinic_id()) and public.can_access_agenda(unit_id, professional_id));

-- Bloqueio sem profissional (unidade toda): dentista não cria nem apaga.
create policy "agenda: ler bloqueios das unidades permitidas"
  on public.schedule_blocks for select to authenticated
  using (clinic_id = (select public.current_clinic_id()) and public.can_access_unit(unit_id));

create policy "agenda: criar bloqueios"
  on public.schedule_blocks for insert to authenticated
  with check (
    clinic_id = (select public.current_clinic_id())
    and public.can_access_unit(unit_id)
    and (
      not (select public.has_role('dentist'))
      or professional_id in (select public.current_professional_ids())
    )
  );

create policy "agenda: apagar bloqueios"
  on public.schedule_blocks for delete to authenticated
  using (
    clinic_id = (select public.current_clinic_id())
    and public.can_access_unit(unit_id)
    and (
      not (select public.has_role('dentist'))
      or professional_id in (select public.current_professional_ids())
    )
  );

-- Tempo real: várias recepcionistas vendo a mesma agenda.
alter publication supabase_realtime add table public.appointments, public.schedule_blocks;
