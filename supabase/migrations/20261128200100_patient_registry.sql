-- Fase 3, P4: cadastro completo do paciente e origens configuráveis.
--
-- Esta migration só acrescenta (o código antigo continua funcionando):
--  * patient_sources: lista de origens por clínica (nome, ordem, ativa), com
--    as padrões criadas para toda clínica. "key" identifica as padrões
--    (cores do Instagram e do Google, formulário público, agendamento online).
--  * patients.source_id, leads.source_id e crm_campaigns.source_id apontam
--    para a lista; os enums antigos são copiados aqui e apagados numa
--    migration de limpeza depois que o código novo estiver no ar.
--  * Colunas novas do cadastro (todas opcionais), "outros telefones",
--    numeração automática de prontuário e e-mail obrigatório por clínica.
--  * Histórico de edição: audit_log ganha "changes" (de → para) e o cadastro
--    do paciente passa a ser registrado; patient_history() mostra a qualquer
--    membro da clínica só os campos do cadastro.
--  * Foto do paciente no bucket privado: {clinic_id}/patient-photos/{patient_id}/...
--    (cadastro, não prontuário: todo membro lê e envia).

-- Origens ----------------------------------------------------------------------------------

create table public.patient_sources (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  name text not null check (length(trim(name)) > 0 and length(name) <= 60),
  -- Origem padrão (indicacao, instagram...); null para as criadas pela clínica.
  key text check (key ~ '^[a-z_]{2,20}$'),
  active boolean not null default true,
  position smallint not null default 0 check (position between 0 and 999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, clinic_id),
  unique (clinic_id, name)
);

create unique index patient_sources_clinic_key on public.patient_sources (clinic_id, key) where key is not null;
create index patient_sources_clinic_position_idx on public.patient_sources (clinic_id, position);

create trigger patient_sources_set_updated_at
  before update on public.patient_sources
  for each row execute function public.set_updated_at();

alter table public.patient_sources enable row level security;
revoke all on public.patient_sources from anon, authenticated;
grant select on public.patient_sources to authenticated;
grant insert (clinic_id, name, active, position) on public.patient_sources to authenticated;
grant update (name, active, position) on public.patient_sources to authenticated;
-- Sem DELETE: origem em uso não some; a gestão desativa.

create policy "origens: membro lê" on public.patient_sources for select to authenticated
  using (clinic_id = (select public.current_clinic_id()));
create policy "origens: gestão cria" on public.patient_sources for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')));
create policy "origens: gestão edita" on public.patient_sources for update to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')))
  with check (clinic_id = (select public.current_clinic_id()));

-- Padrões (sem convênio).
create function public.seed_patient_sources(_clinic_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.patient_sources (clinic_id, key, name, position)
  values
    (_clinic_id, 'indicacao', 'Indicação', 0),
    (_clinic_id, 'instagram', 'Instagram', 1),
    (_clinic_id, 'google', 'Google', 2),
    (_clinic_id, 'facebook', 'Facebook', 3),
    (_clinic_id, 'site', 'Site', 4),
    (_clinic_id, 'escola', 'Escola', 5),
    (_clinic_id, 'outdoor', 'Outdoor', 6),
    (_clinic_id, 'panfleto', 'Panfleto', 7),
    (_clinic_id, 'placa', 'Placa/fachada', 8),
    (_clinic_id, 'radio', 'Rádio', 9),
    (_clinic_id, 'tv', 'TV', 10),
    (_clinic_id, 'revista', 'Revista', 11),
    (_clinic_id, 'outro', 'Outros', 12)
  on conflict do nothing;
$$;
revoke execute on function public.seed_patient_sources(uuid) from public, anon, authenticated;

create function public.on_clinic_created_seed_sources()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_patient_sources(new.id);
  return new;
end;
$$;
revoke execute on function public.on_clinic_created_seed_sources() from public, anon, authenticated;

create trigger clinics_seed_patient_sources
  after insert on public.clinics
  for each row execute function public.on_clinic_created_seed_sources();

select public.seed_patient_sources(id) from public.clinics;

-- "Anúncio" do CRM não está na lista padrão: vira origem própria onde já foi usado.
insert into public.patient_sources (clinic_id, key, name, position)
select distinct c.clinic_id, 'anuncio', 'Anúncio', 13
from (
  select clinic_id from public.leads where source = 'anuncio'
  union select clinic_id from public.crm_campaigns where source = 'anuncio'
) c
on conflict do nothing;

-- Paciente, lead e campanha apontam para a lista ----------------------------------------------

alter table public.patients add column source_id uuid;
alter table public.patients add constraint patients_source_fkey
  foreign key (source_id, clinic_id) references public.patient_sources (id, clinic_id) on delete restrict;
alter table public.leads add column source_id uuid;
alter table public.leads add constraint leads_source_fkey
  foreign key (source_id, clinic_id) references public.patient_sources (id, clinic_id) on delete restrict;
alter table public.crm_campaigns add column source_id uuid;
alter table public.crm_campaigns add constraint crm_campaigns_source_fkey
  foreign key (source_id, clinic_id) references public.patient_sources (id, clinic_id) on delete restrict;

create index patients_source_idx on public.patients (clinic_id, source_id);
create index leads_source_idx on public.leads (clinic_id, source_id);

-- Chave da lista para cada valor antigo ("passante" do CRM = placa/fachada).
create function public.legacy_source_key(_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case _value when 'passante' then 'placa' else _value end;
$$;

update public.patients p set source_id = s.id
from public.patient_sources s
where p.source is not null and s.clinic_id = p.clinic_id and s.key = public.legacy_source_key(p.source::text);

update public.leads l set source_id = s.id
from public.patient_sources s
where s.clinic_id = l.clinic_id and s.key = public.legacy_source_key(l.source::text);

update public.crm_campaigns c set source_id = s.id
from public.patient_sources s
where c.source is not null and s.clinic_id = c.clinic_id and s.key = public.legacy_source_key(c.source::text);

grant insert (source_id) on public.patients, public.leads, public.crm_campaigns to authenticated;
grant update (source_id) on public.patients, public.leads, public.crm_campaigns to authenticated;

-- Colunas novas do cadastro -----------------------------------------------------------------

alter table public.patients
  add column nickname text check (length(nickname) <= 60),
  add column rg text check (length(rg) <= 20),
  add column marital_status text check (marital_status in ('solteiro', 'casado', 'uniao_estavel', 'divorciado', 'viuvo')),
  add column education text check (education in ('fundamental', 'medio', 'superior', 'pos', 'nao_informado')),
  add column occupation text check (length(occupation) <= 80),
  add column workplace text check (length(workplace) <= 120),
  add column record_number text check (length(trim(record_number)) between 1 and 20),
  add column phone_country text not null default '55' check (phone_country ~ '^\d{1,3}$'),
  add column landline text check (landline ~ '^\d{10}$'),
  add column no_email boolean not null default false,
  add column instagram text check (instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  add column facebook text check (facebook ~ '^[A-Za-z0-9.]{1,50}$'),
  add column preferred_contact text not null default 'patient' check (preferred_contact in ('patient', 'guardian')),
  add column father_name text check (length(father_name) <= 160),
  add column mother_name text check (length(mother_name) <= 160),
  add column guardian_relationship text check (length(guardian_relationship) <= 40),
  add column guardian_phone text check (guardian_phone ~ '^\d{10,11}$'),
  add column guardian_birth_date date check (guardian_birth_date between '1900-01-01' and current_date),
  add column guardian_rg text check (length(guardian_rg) <= 20),
  add column photo_path text check (photo_path ~ '^[0-9a-f-]{36}/patient-photos/[0-9a-f-]{36}/[A-Za-z0-9._-]+$');

create unique index patients_clinic_record_number_key on public.patients (clinic_id, record_number) where record_number is not null;

grant insert (
  nickname, rg, marital_status, education, occupation, workplace, record_number, phone_country, landline,
  no_email, instagram, facebook, preferred_contact, father_name, mother_name, guardian_relationship,
  guardian_phone, guardian_birth_date, guardian_rg, photo_path
) on public.patients to authenticated;
grant update (
  nickname, rg, marital_status, education, occupation, workplace, record_number, phone_country, landline,
  no_email, instagram, facebook, preferred_contact, father_name, mother_name, guardian_relationship,
  guardian_phone, guardian_birth_date, guardian_rg, photo_path
) on public.patients to authenticated;

-- Configuração da clínica: numeração automática e e-mail obrigatório.
alter table public.clinics
  add column patient_record_auto boolean not null default false,
  add column patient_record_next integer not null default 1 check (patient_record_next >= 1),
  add column require_patient_email boolean not null default false;
grant update (patient_record_auto, patient_record_next, require_patient_email) on public.clinics to authenticated;

-- Numeração automática: paciente novo sem número recebe o próximo da clínica.
create function public.assign_patient_record_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _next integer;
begin
  if new.record_number is not null then
    return new;
  end if;
  update public.clinics
     set patient_record_next = patient_record_next + 1
   where id = new.clinic_id and patient_record_auto
   returning patient_record_next - 1 into _next;
  if _next is not null then
    -- Pula números já usados à mão.
    while exists (select 1 from public.patients where clinic_id = new.clinic_id and record_number = _next::text) loop
      update public.clinics set patient_record_next = patient_record_next + 1 where id = new.clinic_id
      returning patient_record_next - 1 into _next;
    end loop;
    new.record_number := _next::text;
  end if;
  return new;
end;
$$;
revoke execute on function public.assign_patient_record_number() from public, anon, authenticated;

create trigger patients_record_number
  before insert on public.patients
  for each row execute function public.assign_patient_record_number();

-- Outros telefones -------------------------------------------------------------------------

create table public.patient_phones (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  patient_id uuid not null,
  label text check (length(label) <= 40),
  number text not null check (number ~ '^\d{10,13}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (patient_id, clinic_id) references public.patients (id, clinic_id) on delete cascade
);

create index patient_phones_patient_idx on public.patient_phones (patient_id);

create trigger patient_phones_set_updated_at
  before update on public.patient_phones
  for each row execute function public.set_updated_at();

alter table public.patient_phones enable row level security;
revoke all on public.patient_phones from anon, authenticated;
grant select, delete on public.patient_phones to authenticated;
grant insert (clinic_id, patient_id, label, number) on public.patient_phones to authenticated;
grant update (label, number) on public.patient_phones to authenticated;

-- Mesma regra do cadastro: todo membro da clínica lê e edita.
create policy "telefones do paciente: membro lê" on public.patient_phones for select to authenticated
  using (clinic_id = (select public.current_clinic_id()));
create policy "telefones do paciente: membro inclui" on public.patient_phones for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and exists (select 1 from public.patients p where p.id = patient_id));
create policy "telefones do paciente: membro edita" on public.patient_phones for update to authenticated
  using (clinic_id = (select public.current_clinic_id()))
  with check (clinic_id = (select public.current_clinic_id()));
create policy "telefones do paciente: membro remove" on public.patient_phones for delete to authenticated
  using (clinic_id = (select public.current_clinic_id()));

-- Histórico de edição do cadastro ---------------------------------------------------------

alter table public.audit_log add column changes jsonb;

-- Campos do cadastro que entram no histórico (o resto é interno).
create function public.audit_patient_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _old jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  _new jsonb := to_jsonb(new);
  _changes jsonb := '{}'::jsonb;
  _key text;
begin
  if (select auth.uid()) is null then
    return null;
  end if;
  for _key in select jsonb_object_keys(_new) loop
    if _key in ('id', 'clinic_id', 'created_at', 'updated_at', 'search_name', 'consent_lgpd_by', 'source') then
      continue;
    end if;
    if (_old -> _key) is distinct from (_new -> _key) and not (tg_op = 'INSERT' and (_new -> _key) = 'null'::jsonb) then
      _changes := _changes || jsonb_build_object(_key, jsonb_build_object('from', _old -> _key, 'to', _new -> _key));
    end if;
  end loop;
  if tg_op = 'UPDATE' and _changes = '{}'::jsonb then
    return null;
  end if;
  insert into public.audit_log (clinic_id, user_id, action, table_name, record_id, patient_id, changes)
  values (new.clinic_id, (select auth.uid()), lower(tg_op), 'patients', new.id, new.id, _changes);
  return null;
end;
$$;
revoke execute on function public.audit_patient_changes() from public, anon, authenticated;

create trigger patients_audit
  after insert or update on public.patients
  for each row execute function public.audit_patient_changes();

-- Histórico de um paciente para qualquer membro da clínica (só o cadastro).
create function public.patient_history(_patient_id uuid)
returns table (at timestamptz, action text, user_name text, changes jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select l.at, l.action, coalesce(pr.full_name, 'Alguém da equipe'), l.changes
  from public.audit_log l
  left join public.profiles pr on pr.id = l.user_id
  where l.patient_id = _patient_id
    and l.table_name = 'patients'
    and l.action in ('insert', 'update')
    and l.clinic_id = public.current_clinic_id()
    and l.changes is not null
  order by l.at desc
  limit 200;
$$;
revoke execute on function public.patient_history(uuid) from public, anon;
grant execute on function public.patient_history(uuid) to authenticated;

-- Foto do paciente -------------------------------------------------------------------------

create policy "cadastro: ler fotos de pacientes"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'clinic'
    and (storage.foldername(name))[1] = (select public.current_clinic_id())::text
    and (storage.foldername(name))[2] = 'patient-photos'
  );

create policy "cadastro: enviar fotos de pacientes"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'clinic'
    and (storage.foldername(name))[1] = (select public.current_clinic_id())::text
    and (storage.foldername(name))[2] = 'patient-photos'
  );

create policy "cadastro: remover fotos de pacientes"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'clinic'
    and (storage.foldername(name))[1] = (select public.current_clinic_id())::text
    and (storage.foldername(name))[2] = 'patient-photos'
  );

-- Lista de pacientes por origem da lista nova ----------------------------------------------
-- Mesmas regras de patient_list/patient_segment_counts, filtrando por source_id.
-- (As versões antigas, por enum, saem na migration de limpeza.)

create function public.patients_page(
  _query text default '',
  _segment text default 'active',
  _source_id uuid default null,
  _limit integer default 25,
  _offset integer default 0
)
returns table (
  id uuid,
  full_name text,
  cpf text,
  birth_date date,
  phone text,
  whatsapp text,
  source_id uuid,
  archived_at timestamptz,
  last_visit_at timestamptz,
  next_visit_at timestamptz,
  open_cents bigint,
  overdue_cents bigint,
  in_treatment boolean,
  open_quote boolean,
  return_overdue boolean,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select
      lower(public.immutable_unaccent(trim(coalesce(_query, '')))) as q,
      regexp_replace(coalesce(_query, ''), '\D', '', 'g') as digits,
      (now() at time zone 'America/Sao_Paulo')::date as today
  ),
  base as (
    select
      p.*,
      exists (
        select 1 from public.treatment_plans tp
        join public.treatment_items ti on ti.plan_id = tp.id
        where tp.patient_id = p.id and tp.status in ('approved', 'partially_approved') and ti.status = 'approved'
      ) as in_treatment,
      exists (
        select 1 from public.treatment_plans tp where tp.patient_id = p.id and tp.status = 'presented'
      ) as open_quote,
      exists (
        select 1 from public.patient_returns r, params
        where r.patient_id = p.id and r.status = 'pending' and r.due_date < params.today
      ) as return_overdue
    from public.patients p, params
    where
      (
        (_segment = 'archived' and p.archived_at is not null)
        or (_segment <> 'archived' and p.archived_at is null)
      )
      and (_source_id is null or p.source_id = _source_id)
      and (
        params.q = ''
        or p.search_name like '%' || params.q || '%'
        or (length(params.digits) >= 3 and (
          p.cpf like params.digits || '%'
          or p.phone like '%' || params.digits || '%'
          or p.whatsapp like '%' || params.digits || '%'
        ))
      )
  ),
  filtered as (
    select b.*, count(*) over () as total_count
    from base b, params
    where
      _segment in ('active', 'archived')
      or (_segment = 'in_treatment' and b.in_treatment)
      or (_segment = 'open_quote' and b.open_quote)
      or (_segment = 'return_overdue' and b.return_overdue)
      or (_segment = 'birthday' and extract(month from b.birth_date) = extract(month from params.today))
    order by b.search_name, b.id
    limit least(greatest(_limit, 1), 100)
    offset greatest(_offset, 0)
  )
  select
    f.id, f.full_name, f.cpf, f.birth_date, f.phone, f.whatsapp, f.source_id, f.archived_at,
    (select max(a.starts_at) from public.appointments a
      where a.patient_id = f.id and a.status = 'done' and a.starts_at < now()) as last_visit_at,
    (select min(a.starts_at) from public.appointments a
      where a.patient_id = f.id and a.starts_at >= now() and a.status not in ('canceled', 'no_show', 'done')) as next_visit_at,
    coalesce((select sum(r.amount_cents) from public.receivables r
      where r.patient_id = f.id and r.status in ('open', 'overdue')), 0)::bigint as open_cents,
    coalesce((select sum(r.amount_cents) from public.receivables r
      where r.patient_id = f.id and r.status = 'overdue'), 0)::bigint as overdue_cents,
    f.in_treatment, f.open_quote, f.return_overdue, f.total_count
  from filtered f
  order by f.search_name, f.id;
$$;

create function public.patients_segment_counts(
  _query text default '',
  _source_id uuid default null
)
returns table (
  active bigint,
  in_treatment bigint,
  open_quote bigint,
  return_overdue bigint,
  birthday bigint,
  archived bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select
      lower(public.immutable_unaccent(trim(coalesce(_query, '')))) as q,
      regexp_replace(coalesce(_query, ''), '\D', '', 'g') as digits,
      (now() at time zone 'America/Sao_Paulo')::date as today
  ),
  base as (
    select p.id, p.archived_at, p.birth_date
    from public.patients p, params
    where
      (_source_id is null or p.source_id = _source_id)
      and (
        params.q = ''
        or p.search_name like '%' || params.q || '%'
        or (length(params.digits) >= 3 and (
          p.cpf like params.digits || '%'
          or p.phone like '%' || params.digits || '%'
          or p.whatsapp like '%' || params.digits || '%'
        ))
      )
  )
  select
    count(*) filter (where b.archived_at is null),
    count(*) filter (where b.archived_at is null and exists (
      select 1 from public.treatment_plans tp
      join public.treatment_items ti on ti.plan_id = tp.id
      where tp.patient_id = b.id and tp.status in ('approved', 'partially_approved') and ti.status = 'approved'
    )),
    count(*) filter (where b.archived_at is null and exists (
      select 1 from public.treatment_plans tp where tp.patient_id = b.id and tp.status = 'presented'
    )),
    count(*) filter (where b.archived_at is null and exists (
      select 1 from public.patient_returns r
      where r.patient_id = b.id and r.status = 'pending' and r.due_date < params.today
    )),
    count(*) filter (where b.archived_at is null and extract(month from b.birth_date) = extract(month from params.today)),
    count(*) filter (where b.archived_at is not null)
  from base b, params;
$$;

revoke execute on function public.patients_page(text, text, uuid, integer, integer) from public, anon;
grant execute on function public.patients_page(text, text, uuid, integer, integer) to authenticated;
revoke execute on function public.patients_segment_counts(text, uuid) from public, anon;
grant execute on function public.patients_segment_counts(text, uuid) to authenticated;

-- Assinatura vencida: as tabelas novas seguem a mesma trava das outras.
create trigger patient_sources_enforce_writable before insert or update or delete on public.patient_sources
  for each row execute function public.enforce_clinic_writable();
create trigger patient_phones_enforce_writable before insert or update or delete on public.patient_phones
  for each row execute function public.enforce_clinic_writable();
