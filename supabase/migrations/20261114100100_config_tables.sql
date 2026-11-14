-- Etapa 3: tabelas de configuração da clínica.
-- Profissionais, cadeiras, horários, procedimentos, formas de pagamento e
-- modelos de anamnese. Nada aqui é apagado pelo app (só desativado), exceto
-- linhas de horário, que são substituídas ao editar a grade semanal.

create extension if not exists btree_gist with schema extensions;

-- Faixa de horário (sem data), usada para impedir horários sobrepostos.
create type public.timerange as range (subtype = time);

-- Chaves compostas (id, clinic_id): permitem FKs que garantem que registros
-- relacionados são da MESMA clínica (ex.: cadeira e unidade).
alter table public.units add constraint units_id_clinic_key unique (id, clinic_id);
alter table public.clinic_members add constraint clinic_members_id_clinic_key unique (id, clinic_id);

-- Profissionais -----------------------------------------------------------------

create table public.professionals (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  -- Membro da equipe que é este profissional (para "minha agenda"). Opcional.
  member_id uuid,
  name text not null check (length(trim(name)) > 0),
  cro text,
  specialty text,
  color text not null default '#0e7490' check (color ~ '^#[0-9a-fA-F]{6}$'),
  -- Comissões são Fase 2: a coluna existe, mas não aparece na tela.
  commission_percent numeric(5, 2) check (commission_percent between 0 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, clinic_id),
  -- Se o vínculo de membro some (conta apagada), o profissional continua, sem vínculo.
  foreign key (member_id, clinic_id) references public.clinic_members (id, clinic_id) on delete set null (member_id)
);

create index professionals_clinic_id_idx on public.professionals (clinic_id);
create unique index professionals_member_id_key on public.professionals (member_id) where member_id is not null;

create trigger professionals_set_updated_at
  before update on public.professionals
  for each row execute function public.set_updated_at();

-- Cadeiras (por unidade) --------------------------------------------------------

create table public.chairs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  unit_id uuid not null,
  name text not null check (length(trim(name)) > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (unit_id, clinic_id) references public.units (id, clinic_id) on delete restrict
);

create index chairs_clinic_id_idx on public.chairs (clinic_id);
create index chairs_unit_id_idx on public.chairs (unit_id);

create trigger chairs_set_updated_at
  before update on public.chairs
  for each row execute function public.set_updated_at();

-- Horários de atendimento --------------------------------------------------------

create table public.professional_schedules (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  unit_id uuid not null,
  professional_id uuid not null,
  -- 0 = domingo ... 6 = sábado
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time),
  foreign key (unit_id, clinic_id) references public.units (id, clinic_id) on delete restrict,
  foreign key (professional_id, clinic_id) references public.professionals (id, clinic_id) on delete restrict,
  -- O mesmo profissional não atende em dois lugares ao mesmo tempo.
  constraint professional_schedules_no_overlap exclude using gist (
    professional_id with =,
    weekday with =,
    public.timerange(start_time, end_time) with &&
  )
);

create index professional_schedules_clinic_id_idx on public.professional_schedules (clinic_id);
create index professional_schedules_unit_id_idx on public.professional_schedules (unit_id);

create trigger professional_schedules_set_updated_at
  before update on public.professional_schedules
  for each row execute function public.set_updated_at();

-- Procedimentos -------------------------------------------------------------------

create table public.procedures (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  code text,
  category text,
  price_cents integer not null default 0 check (price_cents >= 0),
  duration_min integer not null default 30 check (duration_min between 5 and 600),
  applies_to_tooth boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index procedures_clinic_id_idx on public.procedures (clinic_id);

create trigger procedures_set_updated_at
  before update on public.procedures
  for each row execute function public.set_updated_at();

-- Formas de pagamento ---------------------------------------------------------------

create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  fee_percent numeric(5, 2) not null default 0 check (fee_percent between 0 and 100),
  days_to_receive integer not null default 0 check (days_to_receive between 0 and 365),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payment_methods_clinic_id_idx on public.payment_methods (clinic_id);

create trigger payment_methods_set_updated_at
  before update on public.payment_methods
  for each row execute function public.set_updated_at();

-- Modelos de anamnese (editor na Etapa 6) ---------------------------------------------

create table public.anamnesis_templates (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  -- [{ id, label, type: 'yes_no' | 'text', alert: boolean, details: boolean }]
  questions jsonb not null default '[]'::jsonb check (jsonb_typeof(questions) = 'array'),
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index anamnesis_templates_clinic_id_idx on public.anamnesis_templates (clinic_id);

create trigger anamnesis_templates_set_updated_at
  before update on public.anamnesis_templates
  for each row execute function public.set_updated_at();

alter table public.professionals enable row level security;
alter table public.chairs enable row level security;
alter table public.professional_schedules enable row level security;
alter table public.procedures enable row level security;
alter table public.payment_methods enable row level security;
alter table public.anamnesis_templates enable row level security;
