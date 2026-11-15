-- Etapa 20: controle protético, laboratórios e alinhadores.
--
--  * Laboratórios com tabela de preços por serviço.
--  * Ordem de serviço ligada ao paciente (e opcionalmente ao item do
--    orçamento), com etapas, envio e retorno previsto, custo. Alinhadores usam
--    a mesma ordem com número de placas e troca a cada X dias.
--  * O custo das ordens de um item vira o custo de laboratório do item
--    (treatment_items.lab_cost_cents), descontado da comissão (Etapa 14).
--  * A gestão lança o custo em contas a pagar com um clique (create_lab_payable).
--  * Todo membro da clínica acompanha as ordens (recepção, dentista, gestão).

create type public.prosthetic_kind as enum ('prosthesis', 'aligner');
create type public.prosthetic_stage as enum ('impression', 'sent', 'try_in', 'adjustment', 'ready', 'delivered', 'canceled');

create table public.labs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  name text not null check (length(trim(name)) > 0 and length(name) <= 120),
  contact_name text check (length(contact_name) <= 120),
  phone text check (phone ~ '^\d{10,11}$'),
  email text check (length(email) <= 160),
  notes text check (length(notes) <= 500),
  supplier_id uuid,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, clinic_id),
  foreign key (supplier_id, clinic_id) references public.suppliers (id, clinic_id) on delete set null (supplier_id)
);

create table public.lab_services (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  lab_id uuid not null,
  name text not null check (length(trim(name)) > 0 and length(name) <= 120),
  price_cents integer not null default 0 check (price_cents >= 0),
  days smallint check (days between 0 and 180),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, clinic_id),
  foreign key (lab_id, clinic_id) references public.labs (id, clinic_id) on delete cascade
);

create table public.prosthetic_orders (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  unit_id uuid not null,
  patient_id uuid not null,
  professional_id uuid,
  plan_item_id uuid,
  lab_id uuid,
  lab_service_id uuid,
  kind public.prosthetic_kind not null default 'prosthesis',
  work_type text not null check (length(trim(work_type)) > 0 and length(work_type) <= 120),
  teeth smallint[] not null default '{}',
  shade text check (length(shade) <= 40),
  material text check (length(material) <= 80),
  stage public.prosthetic_stage not null default 'impression',
  sent_on date,
  expected_return_on date,
  returned_on date,
  cost_cents integer not null default 0 check (cost_cents >= 0),
  payable_id uuid,
  -- Alinhadores
  aligner_total smallint check (aligner_total between 1 and 99),
  aligner_change_days smallint check (aligner_change_days between 1 and 60),
  aligners_delivered smallint not null default 0 check (aligners_delivered >= 0),
  aligner_started_on date,
  notes text check (length(notes) <= 1000),
  stage_changed_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind = 'prosthesis' or (aligner_total is not null and aligner_change_days is not null)),
  check (aligner_total is null or aligners_delivered <= aligner_total),
  check (expected_return_on is null or sent_on is null or expected_return_on >= sent_on),
  foreign key (unit_id, clinic_id) references public.units (id, clinic_id) on delete restrict,
  foreign key (patient_id, clinic_id) references public.patients (id, clinic_id) on delete restrict,
  foreign key (professional_id, clinic_id) references public.professionals (id, clinic_id) on delete restrict,
  foreign key (lab_id, clinic_id) references public.labs (id, clinic_id) on delete restrict,
  foreign key (lab_service_id, clinic_id) references public.lab_services (id, clinic_id) on delete set null (lab_service_id),
  foreign key (payable_id, clinic_id) references public.payables (id, clinic_id) on delete set null (payable_id)
);
create index prosthetic_orders_clinic_stage_idx on public.prosthetic_orders (clinic_id, stage);
create index prosthetic_orders_patient_idx on public.prosthetic_orders (patient_id);
create index prosthetic_orders_item_idx on public.prosthetic_orders (plan_item_id) where plan_item_id is not null;

do $$
declare
  _table text;
begin
  foreach _table in array array['labs', 'lab_services', 'prosthetic_orders'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', _table || '_set_updated_at', _table);
    execute format('create trigger %I before insert or update or delete on public.%I for each row execute function public.enforce_clinic_writable()', _table || '_enforce_writable', _table);
  end loop;
end;
$$;

create trigger prosthetic_orders_audit after insert or update or delete on public.prosthetic_orders
  for each row execute function public.audit_changes();

-- Item do orçamento precisa ser do mesmo paciente; data da mudança de etapa.
create function public.guard_prosthetic_orders()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.plan_item_id is not null and not exists (
    select 1 from public.treatment_items i join public.treatment_plans p on p.id = i.plan_id
     where i.id = new.plan_item_id and p.patient_id = new.patient_id and p.clinic_id = new.clinic_id
  ) then
    raise exception 'O item do orçamento não é deste paciente.' using errcode = 'OP001';
  end if;
  if tg_op = 'UPDATE' and new.stage is distinct from old.stage then
    new.stage_changed_at := now();
    if new.stage = 'sent' and new.sent_on is null then
      new.sent_on := public.today_sp();
    end if;
    if new.stage in ('ready', 'try_in') and old.stage = 'sent' and new.returned_on is null then
      new.returned_on := public.today_sp();
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_prosthetic_orders() from public, anon, authenticated;
create trigger prosthetic_orders_guard before insert or update on public.prosthetic_orders
  for each row execute function public.guard_prosthetic_orders();

-- Custo de laboratório do item = soma das ordens não canceladas do item.
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
     and (select auth.uid()) is not null and not public.has_role('owner', 'manager')
     and coalesce(current_setting('app.lab_cost_sync', true), '') <> 'on' then
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

create function public.sync_item_lab_cost()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _item uuid;
begin
  perform set_config('app.lab_cost_sync', 'on', true);
  foreach _item in array array_remove(array[
    case when tg_op <> 'INSERT' then old.plan_item_id end,
    case when tg_op <> 'DELETE' then new.plan_item_id end
  ], null) loop
    update public.treatment_items
       set lab_cost_cents = coalesce((
         select sum(o.cost_cents) from public.prosthetic_orders o
          where o.plan_item_id = _item and o.stage <> 'canceled'), 0)
     where id = _item;
  end loop;
  perform set_config('app.lab_cost_sync', 'off', true);
  return null;
end;
$$;
revoke execute on function public.sync_item_lab_cost() from public, anon, authenticated;
create trigger prosthetic_orders_lab_cost after insert or update of cost_cents, plan_item_id, stage or delete on public.prosthetic_orders
  for each row execute function public.sync_item_lab_cost();

-- Conta a pagar do laboratório ------------------------------------------------------------------

create function public.create_lab_payable(_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  _o public.prosthetic_orders;
  _lab public.labs;
  _supplier uuid;
  _category uuid;
  _payable uuid;
  _patient text;
begin
  if not public.has_role('owner', 'manager') then
    raise exception 'Só a gestão lança contas a pagar.' using errcode = '42501';
  end if;
  select * into _o from public.prosthetic_orders where id = _order_id and clinic_id = public.current_clinic_id() for update;
  if not found then
    raise exception 'Ordem não encontrada.' using errcode = 'P0002';
  end if;
  if _o.payable_id is not null then
    raise exception 'O custo desta ordem já foi lançado.' using errcode = 'OP002';
  end if;
  if _o.cost_cents <= 0 or _o.lab_id is null then
    raise exception 'Informe o laboratório e o custo antes de lançar.' using errcode = 'OP003';
  end if;
  select * into _lab from public.labs where id = _o.lab_id;
  _supplier := _lab.supplier_id;
  if _supplier is null then
    insert into public.suppliers (clinic_id, name, phone, email) values (_o.clinic_id, _lab.name, _lab.phone, _lab.email) returning id into _supplier;
    update public.labs set supplier_id = _supplier where id = _lab.id;
  end if;
  select id into _category from public.finance_categories where clinic_id = _o.clinic_id and type = 'expense' and name = 'Laboratório de prótese';
  if _category is null then
    insert into public.finance_categories (clinic_id, type, name) values (_o.clinic_id, 'expense', 'Laboratório de prótese') returning id into _category;
  end if;
  select full_name into _patient from public.patients where id = _o.patient_id;
  insert into public.payables (clinic_id, unit_id, supplier_id, category_id, description, amount_cents, due_date, created_by)
  values (_o.clinic_id, _o.unit_id, _supplier, _category, left(_lab.name || ': ' || _o.work_type || ' — ' || _patient, 200), _o.cost_cents,
          greatest(coalesce(_o.expected_return_on, public.today_sp()), public.today_sp()), (select auth.uid()))
  returning id into _payable;
  update public.prosthetic_orders set payable_id = _payable where id = _order_id;
  return _payable;
end;
$$;
revoke execute on function public.create_lab_payable(uuid) from public, anon;
grant execute on function public.create_lab_payable(uuid) to authenticated;

-- Permissões --------------------------------------------------------------------------------------

alter table public.labs enable row level security;
alter table public.lab_services enable row level security;
alter table public.prosthetic_orders enable row level security;
revoke all on public.labs, public.lab_services, public.prosthetic_orders from anon, authenticated;

grant select on public.labs, public.lab_services to authenticated;
grant insert (clinic_id, name, contact_name, phone, email, notes, active) on public.labs to authenticated;
grant update (name, contact_name, phone, email, notes, active) on public.labs to authenticated;
grant insert (clinic_id, lab_id, name, price_cents, days, active) on public.lab_services to authenticated;
grant update (name, price_cents, days, active) on public.lab_services to authenticated;

create policy "laboratórios: membro lê" on public.labs for select to authenticated using (clinic_id = (select public.current_clinic_id()));
create policy "laboratórios: gestão cadastra" on public.labs for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')));
create policy "laboratórios: gestão edita" on public.labs for update to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')))
  with check (clinic_id = (select public.current_clinic_id()));
create policy "serviços: membro lê" on public.lab_services for select to authenticated using (clinic_id = (select public.current_clinic_id()));
create policy "serviços: gestão cadastra" on public.lab_services for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')));
create policy "serviços: gestão edita" on public.lab_services for update to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')))
  with check (clinic_id = (select public.current_clinic_id()));

grant select on public.prosthetic_orders to authenticated;
grant insert (clinic_id, unit_id, patient_id, professional_id, plan_item_id, lab_id, lab_service_id, kind, work_type, teeth, shade, material, stage,
              sent_on, expected_return_on, returned_on, cost_cents, aligner_total, aligner_change_days, aligners_delivered, aligner_started_on, notes, created_by)
  on public.prosthetic_orders to authenticated;
grant update (professional_id, plan_item_id, lab_id, lab_service_id, work_type, teeth, shade, material, stage,
              sent_on, expected_return_on, returned_on, cost_cents, aligner_total, aligner_change_days, aligners_delivered, aligner_started_on, notes)
  on public.prosthetic_orders to authenticated;
create policy "próteses: membro lê" on public.prosthetic_orders for select to authenticated
  using (clinic_id = (select public.current_clinic_id()) and public.can_access_unit(unit_id));
create policy "próteses: membro cria" on public.prosthetic_orders for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and public.can_access_unit(unit_id));
create policy "próteses: membro edita" on public.prosthetic_orders for update to authenticated
  using (clinic_id = (select public.current_clinic_id()) and public.can_access_unit(unit_id))
  with check (clinic_id = (select public.current_clinic_id()));
-- Sem DELETE: ordem errada vira "cancelada".

alter publication supabase_realtime add table public.prosthetic_orders;
