-- Etapa 8: financeiro básico (baixa de recebíveis, caixa do dia, vencidos automáticos).
--
-- Permissões (especificação): owner/manager total; recepção recebe e opera o caixa
-- do dia; dentista só lê os próprios recebimentos (política da Etapa 7).
-- Movimento de caixa não é editado nem apagado: erro se corrige com lançamento contrário.

create type public.cash_movement_type as enum ('in', 'out');

create table public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  unit_id uuid not null,
  type public.cash_movement_type not null,
  amount_cents integer not null check (amount_cents > 0),
  description text not null check (length(trim(description)) > 0 and length(description) <= 200),
  receivable_id uuid,
  payment_method_id uuid,
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (unit_id, clinic_id) references public.units (id, clinic_id) on delete restrict,
  foreign key (receivable_id, clinic_id) references public.receivables (id, clinic_id) on delete restrict,
  foreign key (payment_method_id, clinic_id) references public.payment_methods (id, clinic_id) on delete restrict
);

create index cash_movements_unit_day_idx on public.cash_movements (unit_id, occurred_at);

create trigger cash_movements_set_updated_at
  before update on public.cash_movements
  for each row execute function public.set_updated_at();

-- Quem opera o financeiro (recebe, lança, opera caixa) ----------------------------------

create function public.can_operate_finance()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('owner', 'manager', 'receptionist');
$$;

revoke execute on function public.can_operate_finance() from public, anon;
grant execute on function public.can_operate_finance() to authenticated;

-- Dia de hoje em São Paulo.
create function public.today_sp()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

-- Baixa ------------------------------------------------------------------------------------

create function public.receive_payment(
  _receivable_id uuid,
  _paid_amount_cents integer,
  _payment_method_id uuid,
  _paid_on date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _r public.receivables;
  _fee numeric;
  _when timestamptz;
  _patient text;
begin
  if not public.can_operate_finance() then
    raise exception 'Você não tem permissão para receber pagamentos.' using errcode = '42501';
  end if;
  select * into _r from public.receivables
   where id = _receivable_id and clinic_id = public.current_clinic_id()
   for update;
  if not found or not public.can_access_unit(_r.unit_id) then
    raise exception 'Conta não encontrada.' using errcode = 'P0002';
  end if;
  if _r.status not in ('open', 'overdue') then
    raise exception 'Esta conta já foi paga ou cancelada.' using errcode = 'OF001';
  end if;
  if _paid_amount_cents is null or _paid_amount_cents <= 0 then
    raise exception 'Informe o valor recebido.' using errcode = 'OF002';
  end if;
  if _paid_on is null or _paid_on > public.today_sp() then
    raise exception 'A data do pagamento não pode ser no futuro.' using errcode = 'OF003';
  end if;

  select fee_percent into _fee from public.payment_methods
   where id = _payment_method_id and clinic_id = _r.clinic_id;
  if not found then
    raise exception 'Escolha a forma de pagamento.' using errcode = 'OF004';
  end if;

  -- Pagamento de hoje fica com a hora atual; retroativo, ao meio-dia daquele dia.
  _when := case when _paid_on = public.today_sp() then now()
                else (_paid_on + time '12:00') at time zone 'America/Sao_Paulo' end;

  update public.receivables
     set status = 'paid',
         paid_at = _when,
         paid_amount_cents = _paid_amount_cents,
         fee_cents = round(_paid_amount_cents * _fee / 100),
         payment_method_id = _payment_method_id,
         received_by = (select auth.uid())
   where id = _receivable_id;

  select full_name into _patient from public.patients where id = _r.patient_id;
  insert into public.cash_movements (clinic_id, unit_id, type, amount_cents, description, receivable_id, payment_method_id, occurred_at, created_by)
  values (_r.clinic_id, _r.unit_id, 'in', _paid_amount_cents, 'Recebimento: ' || _patient || ' — ' || _r.description,
          _receivable_id, _payment_method_id, _when, (select auth.uid()));
end;
$$;

-- Estorno (owner/manager): volta a conta para aberta e lança a saída no caixa de hoje.
create function public.reverse_payment(_receivable_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _r public.receivables;
begin
  if not public.has_role('owner', 'manager') then
    raise exception 'Só a gestão pode estornar pagamentos.' using errcode = '42501';
  end if;
  select * into _r from public.receivables
   where id = _receivable_id and clinic_id = public.current_clinic_id()
   for update;
  if not found or _r.status <> 'paid' then
    raise exception 'Só contas pagas podem ser estornadas.' using errcode = 'OF005';
  end if;

  insert into public.cash_movements (clinic_id, unit_id, type, amount_cents, description, receivable_id, payment_method_id, created_by)
  values (_r.clinic_id, _r.unit_id, 'out', _r.paid_amount_cents, 'Estorno: ' || _r.description, _r.id, _r.payment_method_id, (select auth.uid()));

  update public.receivables
     set status = case when due_date < public.today_sp() then 'overdue'::public.receivable_status else 'open'::public.receivable_status end,
         paid_at = null, paid_amount_cents = null, fee_cents = 0, received_by = null
   where id = _receivable_id;
end;
$$;

-- Cancelar conta em aberto (owner/manager).
create function public.cancel_receivable(_receivable_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role('owner', 'manager') then
    raise exception 'Só a gestão pode cancelar contas.' using errcode = '42501';
  end if;
  update public.receivables set status = 'canceled'
   where id = _receivable_id and clinic_id = public.current_clinic_id() and status in ('open', 'overdue');
  if not found then
    raise exception 'Só contas em aberto podem ser canceladas.' using errcode = 'OF006';
  end if;
end;
$$;

-- Vencidos: abertas com vencimento antes de hoje (São Paulo). Roda todo dia pelo pg_cron.
create function public.mark_overdue_receivables()
returns integer
language sql
security definer
set search_path = ''
as $$
  with updated as (
    update public.receivables set status = 'overdue'
     where status = 'open' and due_date < public.today_sp()
    returning 1
  )
  select count(*)::integer from updated;
$$;

revoke execute on function public.receive_payment(uuid, integer, uuid, date) from public, anon;
revoke execute on function public.reverse_payment(uuid) from public, anon;
revoke execute on function public.cancel_receivable(uuid) from public, anon;
revoke execute on function public.mark_overdue_receivables() from public, anon, authenticated;
grant execute on function public.receive_payment(uuid, integer, uuid, date) to authenticated;
grant execute on function public.reverse_payment(uuid) to authenticated;
grant execute on function public.cancel_receivable(uuid) to authenticated;

-- Vencimento nunca fica "em aberto" no passado, nem quando a conta nasce assim.
create function public.set_receivable_overdue_on_write()
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

create trigger receivables_overdue_on_write
  before insert or update of status, due_date on public.receivables
  for each row execute function public.set_receivable_overdue_on_write();

select public.mark_overdue_receivables();

create extension if not exists pg_cron;
select cron.schedule('marcar-recebiveis-vencidos', '5 3 * * *', 'select public.mark_overdue_receivables()');

-- Permissões --------------------------------------------------------------------------------

alter table public.cash_movements enable row level security;
revoke all on public.cash_movements from anon, authenticated;
grant select on public.cash_movements to authenticated;
grant insert (clinic_id, unit_id, type, amount_cents, description, payment_method_id, created_by) on public.cash_movements to authenticated;

create policy "caixa: quem opera lê" on public.cash_movements for select to authenticated
  using (clinic_id = (select public.current_clinic_id()) and public.can_access_unit(unit_id) and (select public.can_operate_finance()));
-- Lançamento manual (sem vínculo com recebível) direto pelo app.
create policy "caixa: quem opera lança" on public.cash_movements for insert to authenticated
  with check (
    clinic_id = (select public.current_clinic_id())
    and public.can_access_unit(unit_id)
    and (select public.can_operate_finance())
    and receivable_id is null
  );

-- Conta a receber avulsa (sem orçamento): quem opera o financeiro.
grant insert (clinic_id, unit_id, patient_id, professional_id, description, amount_cents, due_date, payment_method_id, created_by)
  on public.receivables to authenticated;

create policy "recebíveis: quem opera lança" on public.receivables for insert to authenticated
  with check (
    clinic_id = (select public.current_clinic_id())
    and public.can_access_unit(unit_id)
    and (select public.can_operate_finance())
    and plan_id is null
    and status in ('open', 'overdue')
  );
