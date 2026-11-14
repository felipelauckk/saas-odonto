-- Etapa 2: estrutura multi-clínica (planos, clínicas, unidades, perfis e membros).
-- As políticas de RLS ficam em 20261114000400_tenancy_policies.sql.

-- Tipos -----------------------------------------------------------------------

create type public.member_role as enum ('owner', 'manager', 'dentist', 'receptionist');

create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'canceled');

-- updated_at automático ---------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Planos do SaaS (sem clinic_id: são globais) ------------------------------------

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  price_cents integer not null check (price_cents >= 0),
  max_units integer check (max_units > 0),
  max_professionals integer check (max_professionals > 0),
  features jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger plans_set_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

-- Clínicas (o próprio id é o clinic_id dos demais dados) --------------------------

create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  legal_name text,
  document_cnpj_cpf text,
  phone text,
  email text,
  logo_url text,
  plan_id uuid references public.plans (id) on delete restrict,
  subscription_status public.subscription_status not null default 'trialing',
  trial_ends_at timestamptz,
  asaas_customer_id text,
  asaas_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clinics_plan_id_idx on public.clinics (plan_id);

create trigger clinics_set_updated_at
  before update on public.clinics
  for each row execute function public.set_updated_at();

-- Unidades ------------------------------------------------------------------------

create table public.units (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  address jsonb,
  phone text,
  timezone text not null default 'America/Sao_Paulo',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index units_clinic_id_idx on public.units (clinic_id);

create trigger units_set_updated_at
  before update on public.units
  for each row execute function public.set_updated_at();

-- Perfis (1:1 com auth.users) ------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  -- Clínica escolhida pelo usuário. Só vale se ele for membro ativo dela:
  -- current_clinic_id() confere isso a cada chamada.
  active_clinic_id uuid references public.clinics (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_active_clinic_id_idx on public.profiles (active_clinic_id);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Membros da clínica ----------------------------------------------------------------

create table public.clinic_members (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null,
  -- Unidades permitidas. Vazio = todas (owner e manager sempre veem todas).
  unit_ids uuid[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, user_id)
);

create index clinic_members_user_id_idx on public.clinic_members (user_id);

create trigger clinic_members_set_updated_at
  before update on public.clinic_members
  for each row execute function public.set_updated_at();

-- RLS ligada em tudo desde já (as políticas vêm na migration de políticas).
alter table public.plans enable row level security;
alter table public.clinics enable row level security;
alter table public.units enable row level security;
alter table public.profiles enable row level security;
alter table public.clinic_members enable row level security;
