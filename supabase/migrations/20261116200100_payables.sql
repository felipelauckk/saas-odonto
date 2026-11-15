-- Etapa 13: contas a pagar, categorias, fornecedores, centros de custo,
-- conciliação bancária (OFX) e categoria nas saídas do caixa.
--
-- Permissões: owner/manager. Recepção só lê categorias (para classificar a
-- despesa que lança no caixa do dia, regra que já existe desde a Etapa 8).

create type public.category_type as enum ('income', 'expense');
create type public.payable_status as enum ('open', 'paid', 'overdue', 'canceled');
create type public.bank_tx_status as enum ('unmatched', 'matched', 'ignored');

create table public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  type public.category_type not null,
  name text not null check (length(trim(name)) > 0 and length(name) <= 80),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, clinic_id),
  unique (clinic_id, type, name)
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  name text not null check (length(trim(name)) > 0 and length(name) <= 160),
  document text check (document ~ '^(\d{11}|\d{14})$'),
  phone text check (phone ~ '^\d{10,11}$'),
  email text check (length(email) <= 160),
  notes text check (length(notes) <= 1000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, clinic_id)
);

create table public.cost_centers (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  name text not null check (length(trim(name)) > 0 and length(name) <= 80),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, clinic_id)
);

create table public.payables (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  unit_id uuid not null,
  supplier_id uuid,
  category_id uuid not null,
  cost_center_id uuid,
  description text not null check (length(trim(description)) > 0 and length(description) <= 200),
  amount_cents integer not null check (amount_cents > 0),
  due_date date not null,
  installment_number smallint not null default 1 check (installment_number >= 1),
  installment_total smallint not null default 1 check (installment_total >= installment_number),
  -- Mesma conta recorrente (aluguel, salário...) ou mesmo parcelamento.
  group_id uuid,
  recurring boolean not null default false,
  status public.payable_status not null default 'open',
  paid_at timestamptz,
  paid_amount_cents integer check (paid_amount_cents > 0),
  payment_method_id uuid,
  attachment_path text,
  notes text check (length(notes) <= 1000),
  created_by uuid references auth.users (id) on delete set null,
  paid_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, clinic_id),
  check ((status = 'paid') = (paid_at is not null and paid_amount_cents is not null)),
  foreign key (unit_id, clinic_id) references public.units (id, clinic_id) on delete restrict,
  foreign key (supplier_id, clinic_id) references public.suppliers (id, clinic_id) on delete restrict,
  foreign key (category_id, clinic_id) references public.finance_categories (id, clinic_id) on delete restrict,
  foreign key (cost_center_id, clinic_id) references public.cost_centers (id, clinic_id) on delete restrict,
  foreign key (payment_method_id, clinic_id) references public.payment_methods (id, clinic_id) on delete restrict
);
create index payables_clinic_due_idx on public.payables (clinic_id, due_date);
create index payables_group_idx on public.payables (group_id);

-- Saídas do caixa ganham categoria e vínculo com a conta paga.
alter table public.cash_movements add column category_id uuid;
alter table public.cash_movements add column payable_id uuid;
alter table public.cash_movements add constraint cash_movements_category_fk
  foreign key (category_id, clinic_id) references public.finance_categories (id, clinic_id) on delete restrict;
alter table public.cash_movements add constraint cash_movements_payable_fk
  foreign key (payable_id, clinic_id) references public.payables (id, clinic_id) on delete restrict;
alter table public.cash_movements add constraint cash_movements_id_clinic_key unique (id, clinic_id);

-- Extrato bancário importado (OFX).
create table public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  account_label text check (length(account_label) <= 80),
  fitid text not null check (length(fitid) <= 120),
  posted_on date not null,
  amount_cents integer not null check (amount_cents <> 0),
  description text check (length(description) <= 300),
  status public.bank_tx_status not null default 'unmatched',
  receivable_id uuid,
  payable_id uuid,
  cash_movement_id uuid,
  matched_by uuid references auth.users (id) on delete set null,
  matched_at timestamptz,
  imported_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, account_label, fitid),
  check ((status = 'matched') = (receivable_id is not null or payable_id is not null or cash_movement_id is not null)),
  foreign key (receivable_id, clinic_id) references public.receivables (id, clinic_id) on delete restrict,
  foreign key (payable_id, clinic_id) references public.payables (id, clinic_id) on delete restrict,
  foreign key (cash_movement_id, clinic_id) references public.cash_movements (id, clinic_id) on delete restrict
);
create index bank_transactions_clinic_idx on public.bank_transactions (clinic_id, posted_on desc);

do $$
declare
  _table text;
begin
  foreach _table in array array['finance_categories', 'suppliers', 'cost_centers', 'payables', 'bank_transactions'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', _table || '_set_updated_at', _table);
    execute format('create trigger %I before insert or update or delete on public.%I for each row execute function public.enforce_clinic_writable()', _table || '_enforce_writable', _table);
  end loop;
end;
$$;
create trigger payables_audit after insert or update or delete on public.payables
  for each row execute function public.audit_changes();

-- Vencidas: mesma regra das contas a receber.
create function public.set_payable_overdue_on_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'open' and new.due_date < public.today_sp() then
    new.status := 'overdue';
  end if;
  return new;
end;
$$;
revoke execute on function public.set_payable_overdue_on_write() from public, anon, authenticated;
create trigger payables_overdue_on_write before insert or update of status, due_date on public.payables
  for each row execute function public.set_payable_overdue_on_write();

create or replace function public.mark_overdue_receivables()
returns integer
language sql
security definer
set search_path = ''
as $$
  with r as (
    update public.receivables set status = 'overdue' where status = 'open' and due_date < public.today_sp() returning 1
  ), p as (
    update public.payables set status = 'overdue' where status = 'open' and due_date < public.today_sp() returning 1
  )
  select ((select count(*) from r) + (select count(*) from p))::integer;
$$;

-- Pagar conta: marca paga e lança a saída no caixa da unidade (owner/manager).
create function public.pay_payable(_payable_id uuid, _paid_amount_cents integer, _payment_method_id uuid, _paid_on date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _p public.payables;
  _when timestamptz;
begin
  if not public.has_role('owner', 'manager') then
    raise exception 'Só a gestão paga contas.' using errcode = '42501';
  end if;
  select * into _p from public.payables where id = _payable_id and clinic_id = public.current_clinic_id() for update;
  if not found then
    raise exception 'Conta não encontrada.' using errcode = 'P0002';
  end if;
  if _p.status not in ('open', 'overdue') then
    raise exception 'Esta conta já foi paga ou cancelada.' using errcode = 'OF001';
  end if;
  if _paid_amount_cents is null or _paid_amount_cents <= 0 then
    raise exception 'Informe o valor pago.' using errcode = 'OF002';
  end if;
  if _paid_on is null or _paid_on > public.today_sp() then
    raise exception 'A data do pagamento não pode ser no futuro.' using errcode = 'OF003';
  end if;
  if _payment_method_id is not null and not exists (select 1 from public.payment_methods where id = _payment_method_id and clinic_id = _p.clinic_id) then
    raise exception 'Forma de pagamento inválida.' using errcode = 'OF004';
  end if;
  _when := case when _paid_on = public.today_sp() then now() else (_paid_on + time '12:00') at time zone 'America/Sao_Paulo' end;

  update public.payables
     set status = 'paid', paid_at = _when, paid_amount_cents = _paid_amount_cents,
         payment_method_id = coalesce(_payment_method_id, payment_method_id), paid_by = (select auth.uid())
   where id = _payable_id;

  insert into public.cash_movements (clinic_id, unit_id, type, amount_cents, description, payment_method_id, category_id, payable_id, occurred_at, created_by)
  values (_p.clinic_id, _p.unit_id, 'out', _paid_amount_cents, 'Pagamento: ' || _p.description,
          coalesce(_payment_method_id, _p.payment_method_id), _p.category_id, _p.id, _when, (select auth.uid()));
end;
$$;
revoke execute on function public.pay_payable(uuid, integer, uuid, date) from public, anon;
grant execute on function public.pay_payable(uuid, integer, uuid, date) to authenticated;

-- Permissões ----------------------------------------------------------------------------

alter table public.finance_categories enable row level security;
alter table public.suppliers enable row level security;
alter table public.cost_centers enable row level security;
alter table public.payables enable row level security;
alter table public.bank_transactions enable row level security;
revoke all on public.finance_categories, public.suppliers, public.cost_centers, public.payables, public.bank_transactions from anon, authenticated;

grant select on public.finance_categories to authenticated;
grant insert (clinic_id, type, name, active) on public.finance_categories to authenticated;
grant update (name, active) on public.finance_categories to authenticated;
create policy "categorias: membro lê" on public.finance_categories for select to authenticated
  using (clinic_id = (select public.current_clinic_id()));
create policy "categorias: gestão cria" on public.finance_categories for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')));
create policy "categorias: gestão edita" on public.finance_categories for update to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')))
  with check (clinic_id = (select public.current_clinic_id()));

grant select on public.suppliers, public.cost_centers to authenticated;
grant insert (clinic_id, name, document, phone, email, notes, active) on public.suppliers to authenticated;
grant update (name, document, phone, email, notes, active) on public.suppliers to authenticated;
grant insert (clinic_id, name, active) on public.cost_centers to authenticated;
grant update (name, active) on public.cost_centers to authenticated;

grant select on public.payables to authenticated;
grant insert (clinic_id, unit_id, supplier_id, category_id, cost_center_id, description, amount_cents, due_date,
  installment_number, installment_total, group_id, recurring, payment_method_id, attachment_path, notes, created_by) on public.payables to authenticated;
-- Pagar é pela função pay_payable; o app só edita conta em aberto e cancela.
grant update (supplier_id, category_id, cost_center_id, description, amount_cents, due_date, payment_method_id, attachment_path, notes, status)
  on public.payables to authenticated;

grant select on public.bank_transactions to authenticated;
grant insert (clinic_id, account_label, fitid, posted_on, amount_cents, description, imported_by) on public.bank_transactions to authenticated;
grant update (status, receivable_id, payable_id, cash_movement_id, matched_by, matched_at) on public.bank_transactions to authenticated;

do $$
declare
  _table text;
begin
  foreach _table in array array['suppliers', 'cost_centers', 'payables', 'bank_transactions'] loop
    execute format('create policy "gestão lê" on public.%I for select to authenticated using (clinic_id = (select public.current_clinic_id()) and (select public.has_role(''owner'', ''manager'')))', _table);
    execute format('create policy "gestão cria" on public.%I for insert to authenticated with check (clinic_id = (select public.current_clinic_id()) and (select public.has_role(''owner'', ''manager'')))', _table);
    execute format('create policy "gestão edita" on public.%I for update to authenticated using (clinic_id = (select public.current_clinic_id()) and (select public.has_role(''owner'', ''manager''))) with check (clinic_id = (select public.current_clinic_id()))', _table);
  end loop;
end;
$$;

-- Conta paga não volta pelo app: só cancela conta em aberto.
create function public.guard_payables()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  if old.status = 'paid' then
    raise exception 'Conta paga não pode ser alterada.' using errcode = 'OF007';
  end if;
  if new.status = 'paid' then
    raise exception 'Use a baixa para pagar a conta.' using errcode = 'OF007';
  end if;
  if old.status = 'canceled' then
    raise exception 'Conta cancelada não pode ser alterada.' using errcode = 'OF007';
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_payables() from public, anon, authenticated;
create trigger payables_guard before update on public.payables for each row execute function public.guard_payables();

-- Recepção classifica a saída que lança no caixa; o app passa a gravar a categoria.
grant insert (category_id) on public.cash_movements to authenticated;

-- Comprovantes: {clinic_id}/finance/... só owner/manager.
create policy "financeiro: gestão lê anexos" on storage.objects for select to authenticated
  using (bucket_id = 'clinic' and (storage.foldername(name))[1] = (select public.current_clinic_id())::text
         and (storage.foldername(name))[2] = 'finance' and (select public.has_role('owner', 'manager')));
create policy "financeiro: gestão envia anexos" on storage.objects for insert to authenticated
  with check (bucket_id = 'clinic' and (storage.foldername(name))[1] = (select public.current_clinic_id())::text
              and (storage.foldername(name))[2] = 'finance' and (select public.has_role('owner', 'manager'))
              and (select public.clinic_writable()));

-- Categorias padrão -----------------------------------------------------------------------

create function public.seed_finance_defaults(_clinic_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.finance_categories (clinic_id, type, name)
  select _clinic_id, c.type::public.category_type, c.name
  from (values
    ('income', 'Tratamentos'), ('income', 'Consultas e avaliações'), ('income', 'Outras receitas'),
    ('expense', 'Aluguel e condomínio'), ('expense', 'Salários e encargos'), ('expense', 'Pró-labore'),
    ('expense', 'Comissões'), ('expense', 'Material odontológico'), ('expense', 'Laboratório de prótese'),
    ('expense', 'Impostos e taxas'), ('expense', 'Energia, água, internet e telefone'), ('expense', 'Marketing'),
    ('expense', 'Sistemas e software'), ('expense', 'Manutenção de equipamentos'), ('expense', 'Contabilidade'),
    ('expense', 'Material de limpeza e escritório'), ('expense', 'Outras despesas')
  ) as c (type, name)
  on conflict (clinic_id, type, name) do nothing;
$$;
revoke execute on function public.seed_finance_defaults(uuid) from public, anon, authenticated;

create or replace function public.on_clinic_created_seed_documents()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_document_defaults(new.id);
  perform public.seed_finance_defaults(new.id);
  return null;
end;
$$;

select public.seed_finance_defaults(id) from public.clinics;
