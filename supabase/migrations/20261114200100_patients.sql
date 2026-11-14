-- Etapa 4: pacientes.
-- Paciente nunca é apagado, só arquivado (archived_at). Todo membro ativo da
-- clínica lê, cadastra, edita e arquiva (decisão de 14/11/2026).

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create type public.patient_source as enum ('indicacao', 'instagram', 'google', 'site', 'outro');
create type public.patient_gender as enum ('female', 'male', 'other', 'not_informed');

-- unaccent não é IMMUTABLE (depende do dicionário); este invólucro fixa o
-- dicionário para poder ser usado em índice e coluna gerada.
create function public.immutable_unaccent(text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, $1);
$$;

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  full_name text not null check (length(trim(full_name)) > 0),
  cpf text check (cpf ~ '^\d{11}$'),
  birth_date date check (birth_date between '1900-01-01' and current_date),
  gender public.patient_gender,
  phone text check (phone ~ '^\d{10,11}$'),
  whatsapp text check (whatsapp ~ '^\d{10,11}$'),
  email text,
  -- { cep, street, number, complement, district, city, state }
  address jsonb,
  source public.patient_source,
  notes text,
  -- Responsável legal (menores de idade).
  guardian_name text,
  guardian_cpf text check (guardian_cpf ~ '^\d{11}$'),
  consent_lgpd_at timestamptz,
  consent_lgpd_by uuid references auth.users (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Nome sem acento e em minúsculas, para a busca.
  search_name text generated always as (lower(public.immutable_unaccent(full_name))) stored
);

create index patients_clinic_id_idx on public.patients (clinic_id);
create unique index patients_clinic_cpf_key on public.patients (clinic_id, cpf) where cpf is not null;
create index patients_search_name_trgm_idx on public.patients using gin (search_name extensions.gin_trgm_ops);
create index patients_phone_idx on public.patients (clinic_id, phone);
create index patients_whatsapp_idx on public.patients (clinic_id, whatsapp);

create trigger patients_set_updated_at
  before update on public.patients
  for each row execute function public.set_updated_at();

alter table public.patients enable row level security;

-- Permissões -------------------------------------------------------------------

revoke all on public.patients from anon, authenticated;
grant select on public.patients to authenticated;
grant insert (
  clinic_id, full_name, cpf, birth_date, gender, phone, whatsapp, email, address, source, notes,
  guardian_name, guardian_cpf, consent_lgpd_at, consent_lgpd_by
) on public.patients to authenticated;
grant update (
  full_name, cpf, birth_date, gender, phone, whatsapp, email, address, source, notes,
  guardian_name, guardian_cpf, consent_lgpd_at, consent_lgpd_by, archived_at
) on public.patients to authenticated;
-- Sem DELETE: paciente só é arquivado.

create policy "membro lê pacientes da clínica ativa"
  on public.patients for select to authenticated
  using (clinic_id = (select public.current_clinic_id()));

create policy "membro cadastra pacientes na clínica ativa"
  on public.patients for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()));

create policy "membro edita pacientes da clínica ativa"
  on public.patients for update to authenticated
  using (clinic_id = (select public.current_clinic_id()))
  with check (clinic_id = (select public.current_clinic_id()));

-- Busca ------------------------------------------------------------------------
-- Um campo só: nome (sem acento, qualquer parte), CPF ou telefone/WhatsApp
-- (por dígitos). SECURITY INVOKER: a RLS limita à clínica ativa.

create function public.search_patients(
  _query text default '',
  _status text default 'active',
  _source public.patient_source default null,
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
  source public.patient_source,
  archived_at timestamptz,
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
      regexp_replace(coalesce(_query, ''), '\D', '', 'g') as digits
  )
  select
    p.id, p.full_name, p.cpf, p.birth_date, p.phone, p.whatsapp, p.source, p.archived_at,
    count(*) over () as total_count
  from public.patients p, params
  where
    (
      (_status = 'active' and p.archived_at is null)
      or (_status = 'archived' and p.archived_at is not null)
      or _status = 'all'
    )
    and (_source is null or p.source = _source)
    and (
      params.q = ''
      or p.search_name like '%' || params.q || '%'
      or (length(params.digits) >= 3 and (
        p.cpf like params.digits || '%'
        or p.phone like '%' || params.digits || '%'
        or p.whatsapp like '%' || params.digits || '%'
      ))
    )
  order by p.search_name, p.id
  limit least(greatest(_limit, 1), 100)
  offset greatest(_offset, 0);
$$;

revoke execute on function public.search_patients(text, text, public.patient_source, integer, integer) from public, anon;
grant execute on function public.search_patients(text, text, public.patient_source, integer, integer) to authenticated;
