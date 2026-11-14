-- Etapa 7: orçamentos (planos de tratamento) e contas a receber geradas na aprovação.
--
--  * Todos os papéis criam e apresentam orçamentos; itens só mudam enquanto o
--    orçamento é rascunho ou apresentado.
--  * A aprovação (total ou parcial) é feita pela função approve_treatment_plan,
--    que gera as parcelas em receivables numa transação só.
--  * Item realizado: dentista, owner ou manager. O plano conclui quando todos os
--    itens aprovados forem realizados.
--  * Recebíveis: owner/manager/recepção veem todos; dentista só os próprios.

create type public.treatment_plan_status as enum (
  'draft', 'presented', 'approved', 'partially_approved', 'rejected', 'completed'
);
create type public.treatment_item_status as enum ('pending', 'approved', 'rejected', 'done');
create type public.receivable_status as enum ('open', 'paid', 'overdue', 'canceled');

alter table public.payment_methods add constraint payment_methods_id_clinic_key unique (id, clinic_id);
alter table public.procedures add constraint procedures_id_clinic_key unique (id, clinic_id);

-- Orçamentos -----------------------------------------------------------------------

create table public.treatment_plans (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  unit_id uuid not null,
  patient_id uuid not null,
  professional_id uuid not null,
  status public.treatment_plan_status not null default 'draft',
  -- Soma dos itens (antes do desconto). Mantido por gatilho.
  total_cents integer not null default 0 check (total_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  installments smallint not null default 1 check (installments between 1 and 48),
  payment_method_id uuid,
  first_due_date date,
  valid_until date,
  notes text check (length(notes) <= 2000),
  presented_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, clinic_id),
  foreign key (unit_id, clinic_id) references public.units (id, clinic_id) on delete restrict,
  foreign key (patient_id, clinic_id) references public.patients (id, clinic_id) on delete restrict,
  foreign key (professional_id, clinic_id) references public.professionals (id, clinic_id) on delete restrict,
  foreign key (payment_method_id, clinic_id) references public.payment_methods (id, clinic_id) on delete restrict
);

create index treatment_plans_clinic_idx on public.treatment_plans (clinic_id, created_at desc);
create index treatment_plans_patient_idx on public.treatment_plans (patient_id, created_at desc);

create trigger treatment_plans_set_updated_at
  before update on public.treatment_plans
  for each row execute function public.set_updated_at();

create table public.treatment_items (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  plan_id uuid not null,
  procedure_id uuid,
  -- Nome do procedimento na época (a tabela de procedimentos pode mudar).
  description text not null check (length(trim(description)) > 0 and length(description) <= 200),
  tooth smallint check (
    tooth is null
    or (tooth / 10 between 1 and 4 and tooth % 10 between 1 and 8)
    or (tooth / 10 between 5 and 8 and tooth % 10 between 1 and 5)
  ),
  faces text[] not null default '{}' check (faces <@ array['M', 'D', 'O', 'V', 'L']),
  price_cents integer not null check (price_cents >= 0),
  status public.treatment_item_status not null default 'pending',
  done_at timestamptz,
  done_by uuid references auth.users (id) on delete set null,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (plan_id, clinic_id) references public.treatment_plans (id, clinic_id) on delete cascade,
  foreign key (procedure_id, clinic_id) references public.procedures (id, clinic_id) on delete restrict
);

create index treatment_items_plan_idx on public.treatment_items (plan_id, position);

create trigger treatment_items_set_updated_at
  before update on public.treatment_items
  for each row execute function public.set_updated_at();

-- Contas a receber --------------------------------------------------------------------

create table public.receivables (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  unit_id uuid not null,
  patient_id uuid not null,
  plan_id uuid,
  -- Profissional responsável (o dentista vê só os próprios recebimentos).
  professional_id uuid,
  description text not null check (length(trim(description)) > 0 and length(description) <= 200),
  amount_cents integer not null check (amount_cents > 0),
  due_date date not null,
  installment_number smallint not null default 1 check (installment_number >= 1),
  installment_total smallint not null default 1 check (installment_total >= installment_number),
  status public.receivable_status not null default 'open',
  paid_at timestamptz,
  paid_amount_cents integer check (paid_amount_cents > 0),
  fee_cents integer not null default 0 check (fee_cents >= 0),
  payment_method_id uuid,
  received_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, clinic_id),
  check ((status = 'paid') = (paid_at is not null and paid_amount_cents is not null)),
  foreign key (unit_id, clinic_id) references public.units (id, clinic_id) on delete restrict,
  foreign key (patient_id, clinic_id) references public.patients (id, clinic_id) on delete restrict,
  foreign key (plan_id, clinic_id) references public.treatment_plans (id, clinic_id) on delete restrict,
  foreign key (professional_id, clinic_id) references public.professionals (id, clinic_id) on delete restrict,
  foreign key (payment_method_id, clinic_id) references public.payment_methods (id, clinic_id) on delete restrict
);

create index receivables_clinic_due_idx on public.receivables (clinic_id, due_date);
create index receivables_patient_idx on public.receivables (patient_id, due_date);
create index receivables_plan_idx on public.receivables (plan_id);

create trigger receivables_set_updated_at
  before update on public.receivables
  for each row execute function public.set_updated_at();

-- Gatilhos de consistência ---------------------------------------------------------------

-- Total do orçamento = soma dos itens (exceto recusados).
create function public.refresh_plan_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _plan uuid := coalesce(new.plan_id, old.plan_id);
begin
  update public.treatment_plans p
     set total_cents = coalesce((
       select sum(i.price_cents) from public.treatment_items i
       where i.plan_id = _plan and i.status <> 'rejected'
     ), 0)
   where p.id = _plan;
  return null;
end;
$$;

create trigger treatment_items_refresh_total
  after insert or update of price_cents, status or delete on public.treatment_items
  for each row execute function public.refresh_plan_total();

-- Itens só mudam (preço, dente, inclusão, exclusão) enquanto o orçamento está aberto.
-- Depois da aprovação, só o status do item muda (realizado).
create function public.guard_treatment_items()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _status public.treatment_plan_status;
begin
  select status into _status from public.treatment_plans where id = coalesce(new.plan_id, old.plan_id);
  if _status in ('draft', 'presented') then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE'
     and new.price_cents = old.price_cents
     and new.tooth is not distinct from old.tooth
     and new.faces = old.faces
     and new.description = old.description then
    return new;
  end if;
  raise exception 'Orçamento já aprovado ou fechado: os itens não podem ser alterados.' using errcode = 'OT001';
end;
$$;

create trigger treatment_items_guard
  before insert or update or delete on public.treatment_items
  for each row execute function public.guard_treatment_items();

-- Realizar item: registra quando e quem; conclui o plano quando todos os aprovados forem feitos.
create function public.on_treatment_item_done()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'done' and old.status is distinct from 'done' then
    if old.status <> 'approved' then
      raise exception 'Só itens aprovados podem ser marcados como realizados.' using errcode = 'OT002';
    end if;
    new.done_at := now();
    new.done_by := (select auth.uid());
  elsif new.status = 'approved' and old.status = 'done' then
    new.done_at := null;
    new.done_by := null;
  end if;
  return new;
end;
$$;

create trigger treatment_items_done
  before update of status on public.treatment_items
  for each row execute function public.on_treatment_item_done();

create function public.refresh_plan_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _plan public.treatment_plans;
begin
  select * into _plan from public.treatment_plans where id = new.plan_id;
  if _plan.status not in ('approved', 'partially_approved', 'completed') then
    return null;
  end if;
  if not exists (select 1 from public.treatment_items where plan_id = new.plan_id and status = 'approved') then
    update public.treatment_plans set status = 'completed' where id = new.plan_id and status <> 'completed';
  elsif _plan.status = 'completed' then
    update public.treatment_plans
       set status = case when exists (select 1 from public.treatment_items where plan_id = new.plan_id and status = 'rejected')
                         then 'partially_approved'::public.treatment_plan_status else 'approved'::public.treatment_plan_status end
     where id = new.plan_id;
  end if;
  return null;
end;
$$;

create trigger treatment_items_completion
  after update of status on public.treatment_items
  for each row execute function public.refresh_plan_completion();

revoke execute on function public.refresh_plan_total() from public, anon, authenticated;
revoke execute on function public.guard_treatment_items() from public, anon, authenticated;
revoke execute on function public.on_treatment_item_done() from public, anon, authenticated;
revoke execute on function public.refresh_plan_completion() from public, anon, authenticated;

-- Aprovação ------------------------------------------------------------------------------
-- Aprova os itens escolhidos (os demais são recusados), aplica o desconto e gera as
-- parcelas mensais. Centavos que sobram da divisão vão para a primeira parcela.

create function public.approve_treatment_plan(
  _plan_id uuid,
  _item_ids uuid[],
  _discount_cents integer,
  _installments integer,
  _first_due_date date,
  _payment_method_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _plan public.treatment_plans;
  _approved_total integer;
  _net integer;
  _base integer;
  _remainder integer;
  _all_count integer;
  _patient_name text;
  i integer;
begin
  select * into _plan from public.treatment_plans
   where id = _plan_id and clinic_id = public.current_clinic_id()
   for update;
  if not found then
    raise exception 'Orçamento não encontrado.' using errcode = 'P0002';
  end if;
  if _plan.status not in ('draft', 'presented') then
    raise exception 'Este orçamento já foi decidido.' using errcode = 'OT003';
  end if;
  if not public.can_access_unit(_plan.unit_id) then
    raise exception 'Sem acesso a esta unidade.' using errcode = '42501';
  end if;
  if coalesce(array_length(_item_ids, 1), 0) = 0 then
    raise exception 'Escolha pelo menos um item para aprovar.' using errcode = 'OT004';
  end if;
  if _installments not between 1 and 48 then
    raise exception 'Número de parcelas inválido.' using errcode = 'OT005';
  end if;
  if _payment_method_id is not null and not exists (
    select 1 from public.payment_methods where id = _payment_method_id and clinic_id = _plan.clinic_id
  ) then
    raise exception 'Forma de pagamento inválida.' using errcode = 'OT006';
  end if;

  update public.treatment_items
     set status = case when id = any (_item_ids) then 'approved'::public.treatment_item_status
                       else 'rejected'::public.treatment_item_status end
   where plan_id = _plan_id;

  select coalesce(sum(price_cents), 0), (select count(*) from public.treatment_items where plan_id = _plan_id)
    into _approved_total, _all_count
    from public.treatment_items
   where plan_id = _plan_id and status = 'approved';

  if _discount_cents < 0 or _discount_cents > _approved_total then
    raise exception 'Desconto maior que o valor aprovado.' using errcode = 'OT007';
  end if;

  _net := _approved_total - _discount_cents;

  update public.treatment_plans
     set status = case when array_length(_item_ids, 1) >= _all_count then 'approved'::public.treatment_plan_status
                       else 'partially_approved'::public.treatment_plan_status end,
         discount_cents = _discount_cents,
         installments = _installments,
         first_due_date = _first_due_date,
         payment_method_id = _payment_method_id,
         approved_at = now(),
         approved_by = (select auth.uid())
   where id = _plan_id;

  if _net > 0 then
    select full_name into _patient_name from public.patients where id = _plan.patient_id;
    _base := _net / _installments;
    _remainder := _net - _base * _installments;
    for i in 1.._installments loop
      insert into public.receivables (
        clinic_id, unit_id, patient_id, plan_id, professional_id, description,
        amount_cents, due_date, installment_number, installment_total, payment_method_id, created_by
      ) values (
        _plan.clinic_id, _plan.unit_id, _plan.patient_id, _plan_id, _plan.professional_id,
        'Orçamento ' || _patient_name || case when _installments > 1 then ' (' || i || '/' || _installments || ')' else '' end,
        _base + case when i = 1 then _remainder else 0 end,
        (_first_due_date + make_interval(months => i - 1))::date,
        i, _installments, _payment_method_id, (select auth.uid())
      );
    end loop;
  end if;
end;
$$;

revoke execute on function public.approve_treatment_plan(uuid, uuid[], integer, integer, date, uuid) from public, anon;
grant execute on function public.approve_treatment_plan(uuid, uuid[], integer, integer, date, uuid) to authenticated;

-- Permissões ------------------------------------------------------------------------------

alter table public.treatment_plans enable row level security;
alter table public.treatment_items enable row level security;
alter table public.receivables enable row level security;

revoke all on public.treatment_plans, public.treatment_items, public.receivables from anon, authenticated;

grant select on public.treatment_plans, public.treatment_items to authenticated;
grant insert (clinic_id, unit_id, patient_id, professional_id, notes, valid_until, created_by) on public.treatment_plans to authenticated;
-- Status só vai para 'presented' ou 'rejected' pelo app (aprovação é pela função).
grant update (professional_id, notes, valid_until, status, presented_at) on public.treatment_plans to authenticated;
grant insert (clinic_id, plan_id, procedure_id, description, tooth, faces, price_cents, position) on public.treatment_items to authenticated;
grant update (description, tooth, faces, price_cents, position, status) on public.treatment_items to authenticated;
grant delete on public.treatment_items to authenticated;

create policy "orçamentos: membro lê" on public.treatment_plans for select to authenticated
  using (clinic_id = (select public.current_clinic_id()));
create policy "orçamentos: membro cria" on public.treatment_plans for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and public.can_access_unit(unit_id) and status = 'draft');
create policy "orçamentos: membro edita aberto" on public.treatment_plans for update to authenticated
  using (clinic_id = (select public.current_clinic_id()) and status in ('draft', 'presented'))
  with check (clinic_id = (select public.current_clinic_id()) and status in ('draft', 'presented', 'rejected'));

create policy "itens: membro lê" on public.treatment_items for select to authenticated
  using (clinic_id = (select public.current_clinic_id()));
create policy "itens: membro inclui" on public.treatment_items for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()));
-- Marcar como realizado é clínico: dentista, owner ou manager. Os demais ajustes, qualquer membro
-- (o gatilho guard_treatment_items só deixa mexer enquanto o orçamento está aberto).
create policy "itens: membro edita" on public.treatment_items for update to authenticated
  using (clinic_id = (select public.current_clinic_id()))
  with check (
    clinic_id = (select public.current_clinic_id())
    and (status not in ('done') or (select public.has_role('owner', 'manager', 'dentist')))
  );
create policy "itens: membro remove" on public.treatment_items for delete to authenticated
  using (clinic_id = (select public.current_clinic_id()));

-- Recebíveis: leitura agora; baixa e lançamentos manuais na Etapa 8.
grant select on public.receivables to authenticated;

create policy "recebíveis: quem pode ver" on public.receivables for select to authenticated
  using (
    clinic_id = (select public.current_clinic_id())
    and public.can_access_unit(unit_id)
    and (
      (select public.has_role('owner', 'manager', 'receptionist'))
      or professional_id in (select public.current_professional_ids())
    )
  );
