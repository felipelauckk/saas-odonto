-- Etapa 21: estoque.
--
--  * Produtos da clínica (unidade de medida, estoque mínimo). O saldo fica em
--    lotes por unidade da clínica (código do lote, validade, custo unitário).
--  * Toda mudança é um movimento (registro, não se edita): compra, saída
--    manual, transferência entre unidades, baixa por procedimento e ajuste.
--  * Saídas consomem primeiro o lote que vence antes (FEFO).
--  * Kit por procedimento: ao marcar o item do orçamento como realizado, o
--    banco baixa os materiais do kit na unidade do orçamento.
--  * Recepção e gestão movimentam; dentista consulta. Compra que gera conta a
--    pagar é só da gestão.

create type public.stock_movement_kind as enum ('purchase', 'manual_out', 'transfer_out', 'transfer_in', 'procedure', 'adjustment');

create table public.stock_products (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  name text not null check (length(trim(name)) > 0 and length(name) <= 120),
  measure text not null default 'un' check (length(trim(measure)) > 0 and length(measure) <= 12),
  category text check (length(category) <= 60),
  min_qty numeric(12, 3) not null default 0 check (min_qty >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, clinic_id),
  unique (clinic_id, name)
);

create table public.stock_lots (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  unit_id uuid not null,
  product_id uuid not null,
  lot_code text check (length(lot_code) <= 40),
  expires_on date,
  qty numeric(12, 3) not null default 0 check (qty >= 0),
  unit_cost_cents integer not null default 0 check (unit_cost_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, clinic_id),
  foreign key (unit_id, clinic_id) references public.units (id, clinic_id) on delete restrict,
  foreign key (product_id, clinic_id) references public.stock_products (id, clinic_id) on delete restrict
);
create index stock_lots_product_idx on public.stock_lots (clinic_id, unit_id, product_id);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  unit_id uuid not null,
  product_id uuid not null,
  lot_id uuid,
  kind public.stock_movement_kind not null,
  -- Positivo entra, negativo sai.
  qty numeric(12, 3) not null check (qty <> 0),
  unit_cost_cents integer not null default 0,
  supplier_id uuid,
  payable_id uuid,
  treatment_item_id uuid references public.treatment_items (id) on delete set null,
  transfer_id uuid,
  note text check (length(note) <= 300),
  -- Baixa por procedimento sem saldo suficiente (o que faltou).
  shortage numeric(12, 3) not null default 0 check (shortage >= 0),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (unit_id, clinic_id) references public.units (id, clinic_id) on delete restrict,
  foreign key (product_id, clinic_id) references public.stock_products (id, clinic_id) on delete restrict,
  foreign key (lot_id, clinic_id) references public.stock_lots (id, clinic_id) on delete set null (lot_id),
  foreign key (supplier_id, clinic_id) references public.suppliers (id, clinic_id) on delete set null (supplier_id),
  foreign key (payable_id, clinic_id) references public.payables (id, clinic_id) on delete set null (payable_id)
);
create index stock_movements_clinic_idx on public.stock_movements (clinic_id, created_at);
create index stock_movements_item_idx on public.stock_movements (treatment_item_id) where treatment_item_id is not null;

create table public.procedure_kits (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  procedure_id uuid not null,
  product_id uuid not null,
  qty numeric(12, 3) not null check (qty > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (procedure_id, product_id),
  foreign key (procedure_id, clinic_id) references public.procedures (id, clinic_id) on delete cascade,
  foreign key (product_id, clinic_id) references public.stock_products (id, clinic_id) on delete cascade
);

do $$
declare
  _table text;
begin
  foreach _table in array array['stock_products', 'stock_lots', 'stock_movements', 'procedure_kits'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', _table || '_set_updated_at', _table);
    execute format('create trigger %I before insert or update or delete on public.%I for each row execute function public.enforce_clinic_writable()', _table || '_enforce_writable', _table);
  end loop;
end;
$$;

create function public.can_operate_stock()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('owner', 'manager', 'receptionist');
$$;
revoke execute on function public.can_operate_stock() from public, anon;
grant execute on function public.can_operate_stock() to authenticated;

-- Núcleo: tira quantidade dos lotes da unidade, vencimento mais próximo primeiro.
-- Devolve o que não havia (falta). Só chamado por funções deste arquivo.
create function public.stock_consume(_clinic_id uuid, _unit_id uuid, _product_id uuid, _qty numeric, _kind public.stock_movement_kind,
                                     _note text, _item_id uuid, _transfer_id uuid, _allow_shortage boolean)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  _left numeric := _qty;
  _lot public.stock_lots;
  _take numeric;
begin
  for _lot in
    select * from public.stock_lots
     where clinic_id = _clinic_id and unit_id = _unit_id and product_id = _product_id and qty > 0
     order by expires_on nulls last, created_at
     for update
  loop
    exit when _left <= 0;
    _take := least(_lot.qty, _left);
    update public.stock_lots set qty = qty - _take where id = _lot.id;
    insert into public.stock_movements (clinic_id, unit_id, product_id, lot_id, kind, qty, unit_cost_cents, treatment_item_id, transfer_id, note, created_by)
    values (_clinic_id, _unit_id, _product_id, _lot.id, _kind, -_take, _lot.unit_cost_cents, _item_id, _transfer_id, _note, (select auth.uid()));
    _left := _left - _take;
  end loop;
  if _left > 0 and not _allow_shortage then
    raise exception 'Estoque insuficiente nesta unidade.' using errcode = 'OE001';
  end if;
  if _left > 0 then
    insert into public.stock_movements (clinic_id, unit_id, product_id, kind, qty, treatment_item_id, note, shortage, created_by)
    values (_clinic_id, _unit_id, _product_id, _kind, -_left, _item_id, coalesce(_note, 'Sem saldo no estoque'), _left, (select auth.uid()));
  end if;
  return greatest(_left, 0);
end;
$$;
revoke execute on function public.stock_consume(uuid, uuid, uuid, numeric, public.stock_movement_kind, text, uuid, uuid, boolean) from public, anon, authenticated;

-- Entrada (compra) ---------------------------------------------------------------------------------

create function public.stock_purchase(_unit_id uuid, _product_id uuid, _qty numeric, _unit_cost_cents integer, _lot_code text,
                                      _expires_on date, _supplier_id uuid, _create_payable boolean, _due_date date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  _clinic uuid := public.current_clinic_id();
  _lot uuid;
  _payable uuid;
  _category uuid;
  _name text;
begin
  if not public.can_operate_stock() or not public.can_access_unit(_unit_id) then
    raise exception 'Sem permissão para movimentar o estoque.' using errcode = '42501';
  end if;
  if _qty is null or _qty <= 0 then
    raise exception 'Informe a quantidade.' using errcode = 'OE002';
  end if;
  if not exists (select 1 from public.stock_products where id = _product_id and clinic_id = _clinic) then
    raise exception 'Produto não encontrado.' using errcode = 'P0002';
  end if;
  if _create_payable then
    if not public.has_role('owner', 'manager') then
      raise exception 'Só a gestão lança contas a pagar.' using errcode = '42501';
    end if;
    if coalesce(_unit_cost_cents, 0) <= 0 then
      raise exception 'Informe o custo para lançar a conta.' using errcode = 'OE003';
    end if;
    select id into _category from public.finance_categories where clinic_id = _clinic and type = 'expense' and name = 'Material odontológico';
    if _category is null then
      insert into public.finance_categories (clinic_id, type, name) values (_clinic, 'expense', 'Material odontológico') returning id into _category;
    end if;
    select name into _name from public.stock_products where id = _product_id;
    insert into public.payables (clinic_id, unit_id, supplier_id, category_id, description, amount_cents, due_date, created_by)
    values (_clinic, _unit_id, _supplier_id, _category, left('Compra: ' || _name, 200), round(_qty * _unit_cost_cents)::int,
            coalesce(_due_date, public.today_sp()), (select auth.uid()))
    returning id into _payable;
  end if;

  select id into _lot from public.stock_lots
   where clinic_id = _clinic and unit_id = _unit_id and product_id = _product_id
     and lot_code is not distinct from nullif(trim(_lot_code), '') and expires_on is not distinct from _expires_on
     and unit_cost_cents = coalesce(_unit_cost_cents, 0)
   limit 1;
  if _lot is null then
    insert into public.stock_lots (clinic_id, unit_id, product_id, lot_code, expires_on, qty, unit_cost_cents)
    values (_clinic, _unit_id, _product_id, nullif(trim(_lot_code), ''), _expires_on, _qty, coalesce(_unit_cost_cents, 0))
    returning id into _lot;
  else
    update public.stock_lots set qty = qty + _qty where id = _lot;
  end if;
  insert into public.stock_movements (clinic_id, unit_id, product_id, lot_id, kind, qty, unit_cost_cents, supplier_id, payable_id, created_by)
  values (_clinic, _unit_id, _product_id, _lot, 'purchase', _qty, coalesce(_unit_cost_cents, 0), _supplier_id, _payable, (select auth.uid()));
  return _lot;
end;
$$;
revoke execute on function public.stock_purchase(uuid, uuid, numeric, integer, text, date, uuid, boolean, date) from public, anon;
grant execute on function public.stock_purchase(uuid, uuid, numeric, integer, text, date, uuid, boolean, date) to authenticated;

-- Saída manual e ajuste ------------------------------------------------------------------------------

create function public.stock_out(_unit_id uuid, _product_id uuid, _qty numeric, _note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_operate_stock() or not public.can_access_unit(_unit_id) then
    raise exception 'Sem permissão para movimentar o estoque.' using errcode = '42501';
  end if;
  if _qty is null or _qty <= 0 then
    raise exception 'Informe a quantidade.' using errcode = 'OE002';
  end if;
  perform public.stock_consume(public.current_clinic_id(), _unit_id, _product_id, _qty, 'manual_out', nullif(trim(_note), ''), null, null, false);
end;
$$;
revoke execute on function public.stock_out(uuid, uuid, numeric, text) from public, anon;
grant execute on function public.stock_out(uuid, uuid, numeric, text) to authenticated;

-- Transferência entre unidades ---------------------------------------------------------------------------

create function public.stock_transfer(_from_unit uuid, _to_unit uuid, _product_id uuid, _qty numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _clinic uuid := public.current_clinic_id();
  _transfer uuid := gen_random_uuid();
  _m record;
  _dest uuid;
begin
  if not public.can_operate_stock() or not public.can_access_unit(_from_unit) or not public.can_access_unit(_to_unit) then
    raise exception 'Sem permissão para movimentar o estoque.' using errcode = '42501';
  end if;
  if _from_unit = _to_unit then
    raise exception 'Escolha unidades diferentes.' using errcode = 'OE004';
  end if;
  if _qty is null or _qty <= 0 then
    raise exception 'Informe a quantidade.' using errcode = 'OE002';
  end if;
  perform public.stock_consume(_clinic, _from_unit, _product_id, _qty, 'transfer_out', 'Transferência entre unidades', null, _transfer, false);
  -- Recria cada lote consumido na unidade de destino (mesmo código, validade e custo).
  for _m in
    select m.qty, l.lot_code, l.expires_on, l.unit_cost_cents
      from public.stock_movements m join public.stock_lots l on l.id = m.lot_id
     where m.transfer_id = _transfer and m.kind = 'transfer_out'
  loop
    select id into _dest from public.stock_lots
     where clinic_id = _clinic and unit_id = _to_unit and product_id = _product_id
       and lot_code is not distinct from _m.lot_code and expires_on is not distinct from _m.expires_on and unit_cost_cents = _m.unit_cost_cents
     limit 1;
    if _dest is null then
      insert into public.stock_lots (clinic_id, unit_id, product_id, lot_code, expires_on, qty, unit_cost_cents)
      values (_clinic, _to_unit, _product_id, _m.lot_code, _m.expires_on, -_m.qty, _m.unit_cost_cents) returning id into _dest;
    else
      update public.stock_lots set qty = qty - _m.qty where id = _dest;
    end if;
    insert into public.stock_movements (clinic_id, unit_id, product_id, lot_id, kind, qty, unit_cost_cents, transfer_id, note, created_by)
    values (_clinic, _to_unit, _product_id, _dest, 'transfer_in', -_m.qty, _m.unit_cost_cents, _transfer, 'Transferência entre unidades', (select auth.uid()));
  end loop;
end;
$$;
revoke execute on function public.stock_transfer(uuid, uuid, uuid, numeric) from public, anon;
grant execute on function public.stock_transfer(uuid, uuid, uuid, numeric) to authenticated;

-- Baixa do kit ao realizar o procedimento -------------------------------------------------------------------

create function public.stock_on_item_done()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _unit uuid;
  _k record;
begin
  if new.status = 'done' and old.status is distinct from 'done' and new.procedure_id is not null then
    select unit_id into _unit from public.treatment_plans where id = new.plan_id;
    for _k in select product_id, qty from public.procedure_kits where procedure_id = new.procedure_id loop
      perform public.stock_consume(new.clinic_id, _unit, _k.product_id, _k.qty, 'procedure', null, new.id, null, true);
    end loop;
  end if;
  return null;
end;
$$;
revoke execute on function public.stock_on_item_done() from public, anon, authenticated;
create trigger treatment_items_stock after update of status on public.treatment_items
  for each row execute function public.stock_on_item_done();

-- Permissões --------------------------------------------------------------------------------------------------

alter table public.stock_products enable row level security;
alter table public.stock_lots enable row level security;
alter table public.stock_movements enable row level security;
alter table public.procedure_kits enable row level security;
revoke all on public.stock_products, public.stock_lots, public.stock_movements, public.procedure_kits from anon, authenticated;

grant select on public.stock_products, public.stock_lots, public.stock_movements, public.procedure_kits to authenticated;
grant insert (clinic_id, name, measure, category, min_qty, active) on public.stock_products to authenticated;
grant update (name, measure, category, min_qty, active) on public.stock_products to authenticated;
grant insert (clinic_id, procedure_id, product_id, qty) on public.procedure_kits to authenticated;
grant update (qty) on public.procedure_kits to authenticated;
grant delete on public.procedure_kits to authenticated;

create policy "produtos: membro lê" on public.stock_products for select to authenticated using (clinic_id = (select public.current_clinic_id()));
create policy "produtos: recepção e gestão cadastram" on public.stock_products for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and (select public.can_operate_stock()));
create policy "produtos: recepção e gestão editam" on public.stock_products for update to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.can_operate_stock()))
  with check (clinic_id = (select public.current_clinic_id()));

create policy "lotes: membro lê" on public.stock_lots for select to authenticated
  using (clinic_id = (select public.current_clinic_id()) and public.can_access_unit(unit_id));
create policy "movimentos: membro lê" on public.stock_movements for select to authenticated
  using (clinic_id = (select public.current_clinic_id()) and public.can_access_unit(unit_id));
-- Lotes e movimentos só mudam pelas funções acima.

create policy "kits: membro lê" on public.procedure_kits for select to authenticated using (clinic_id = (select public.current_clinic_id()));
create policy "kits: gestão monta" on public.procedure_kits for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')));
create policy "kits: gestão edita" on public.procedure_kits for update to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')))
  with check (clinic_id = (select public.current_clinic_id()));
create policy "kits: gestão remove" on public.procedure_kits for delete to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')));
