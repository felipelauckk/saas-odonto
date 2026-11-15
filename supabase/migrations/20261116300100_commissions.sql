-- Etapa 14: comissões.
--
--  * Configuração da clínica: base (recebido ou executado), descontar taxa da
--    forma de pagamento e custo de laboratório antes da comissão.
--  * Regra por profissional: percentual padrão (professionals.commission_percent)
--    e exceções por procedimento (percentual ou valor fixo) ou por categoria.
--  * Fechamento mensal congela o extrato (cópia das linhas), gera a conta a pagar
--    do repasse e o PDF. Gestão vê todos; dentista vê só os próprios.

create type public.commission_base as enum ('received', 'executed');

alter table public.clinics add column commission_base public.commission_base not null default 'received';
alter table public.clinics add column commission_deduct_fees boolean not null default true;
alter table public.clinics add column commission_deduct_lab boolean not null default true;
grant update (commission_base, commission_deduct_fees, commission_deduct_lab) on public.clinics to authenticated;

-- Percentual padrão passa a ser editável pela gestão.
grant update (commission_percent) on public.professionals to authenticated;
grant insert (commission_percent) on public.professionals to authenticated;

-- Custo de laboratório por item do orçamento (descontado da base, se configurado).
alter table public.treatment_items add column lab_cost_cents integer not null default 0 check (lab_cost_cents >= 0);
grant update (lab_cost_cents) on public.treatment_items to authenticated;

create or replace function public.guard_treatment_items()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _status public.treatment_plan_status;
begin
  if tg_op = 'UPDATE' and new.lab_cost_cents is distinct from old.lab_cost_cents
     and (select auth.uid()) is not null and not public.has_role('owner', 'manager') then
    raise exception 'Só a gestão informa o custo de laboratório.' using errcode = '42501';
  end if;
  select status into _status from public.treatment_plans where id = coalesce(new.plan_id, old.plan_id);
  if _status is null or _status in ('draft', 'presented') then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE'
     and new.price_cents = old.price_cents
     and new.tooth is not distinct from old.tooth
     and new.faces = old.faces
     and new.description = old.description then
    return new; -- depois de aprovado só mudam status e custo de laboratório
  end if;
  raise exception 'Orçamento já aprovado ou fechado: os itens não podem ser alterados.' using errcode = 'OT001';
end;
$$;

-- Regras ----------------------------------------------------------------------------------

create table public.commission_rules (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  professional_id uuid not null,
  procedure_id uuid,
  category text check (length(category) <= 60),
  percent numeric(5, 2) check (percent between 0 and 100),
  fixed_cents integer check (fixed_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((procedure_id is null) <> (category is null)),
  check ((percent is null) <> (fixed_cents is null)),
  check (fixed_cents is null or procedure_id is not null),
  foreign key (professional_id, clinic_id) references public.professionals (id, clinic_id) on delete cascade,
  foreign key (procedure_id, clinic_id) references public.procedures (id, clinic_id) on delete cascade
);
create unique index commission_rules_procedure_key on public.commission_rules (professional_id, procedure_id) where procedure_id is not null;
create unique index commission_rules_category_key on public.commission_rules (professional_id, category) where category is not null;

-- Fechamentos -------------------------------------------------------------------------------

create table public.commission_closings (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  professional_id uuid not null,
  period_month date not null check (extract(day from period_month) = 1),
  base public.commission_base not null,
  total_gross_cents integer not null,
  total_base_cents integer not null,
  total_commission_cents integer not null check (total_commission_cents >= 0),
  -- Cópia das linhas do extrato no momento do fechamento.
  lines jsonb not null check (jsonb_typeof(lines) = 'array'),
  payable_id uuid,
  pdf_path text,
  closed_by uuid references auth.users (id) on delete set null,
  closed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (professional_id, period_month),
  foreign key (professional_id, clinic_id) references public.professionals (id, clinic_id) on delete restrict,
  foreign key (payable_id, clinic_id) references public.payables (id, clinic_id) on delete restrict
);

do $$
declare
  _table text;
begin
  foreach _table in array array['commission_rules', 'commission_closings'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', _table || '_set_updated_at', _table);
    execute format('create trigger %I before insert or update or delete on public.%I for each row execute function public.enforce_clinic_writable()', _table || '_enforce_writable', _table);
  end loop;
end;
$$;

alter table public.commission_rules enable row level security;
alter table public.commission_closings enable row level security;
revoke all on public.commission_rules, public.commission_closings from anon, authenticated;

grant select, delete on public.commission_rules to authenticated;
grant insert (clinic_id, professional_id, procedure_id, category, percent, fixed_cents) on public.commission_rules to authenticated;
grant update (percent, fixed_cents) on public.commission_rules to authenticated;

create policy "regras: gestão e o próprio profissional leem" on public.commission_rules for select to authenticated
  using (clinic_id = (select public.current_clinic_id())
         and ((select public.has_role('owner', 'manager')) or professional_id in (select public.current_professional_ids())));
create policy "regras: gestão cria" on public.commission_rules for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')));
create policy "regras: gestão edita" on public.commission_rules for update to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')))
  with check (clinic_id = (select public.current_clinic_id()));
create policy "regras: gestão apaga" on public.commission_rules for delete to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')));

grant select on public.commission_closings to authenticated;
grant insert (clinic_id, professional_id, period_month, base, total_gross_cents, total_base_cents, total_commission_cents, lines, payable_id, closed_by)
  on public.commission_closings to authenticated;

create policy "fechamentos: gestão e o próprio profissional leem" on public.commission_closings for select to authenticated
  using (clinic_id = (select public.current_clinic_id())
         and ((select public.has_role('owner', 'manager')) or professional_id in (select public.current_professional_ids())));
create policy "fechamentos: gestão fecha" on public.commission_closings for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')));
-- Sem UPDATE/DELETE pelo app: fechamento é definitivo (pdf_path é gravado pelo servidor).
