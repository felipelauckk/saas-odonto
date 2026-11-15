-- A trava de contas pagas bloqueava a própria baixa: dentro de pay_payable o
-- usuário continua logado. A baixa marca a transação e a trava deixa passar
-- só nesse caso (o app não consegue chamar set_config diretamente).
create or replace function public.guard_payables()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or current_setting('app.paying_payable', true) = 'on' then
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

create or replace function public.pay_payable(_payable_id uuid, _paid_amount_cents integer, _payment_method_id uuid, _paid_on date)
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

  perform set_config('app.paying_payable', 'on', true);
  update public.payables
     set status = 'paid', paid_at = _when, paid_amount_cents = _paid_amount_cents,
         payment_method_id = coalesce(_payment_method_id, payment_method_id), paid_by = (select auth.uid())
   where id = _payable_id;
  perform set_config('app.paying_payable', 'off', true);

  insert into public.cash_movements (clinic_id, unit_id, type, amount_cents, description, payment_method_id, category_id, payable_id, occurred_at, created_by)
  values (_p.clinic_id, _p.unit_id, 'out', _paid_amount_cents, 'Pagamento: ' || _p.description,
          coalesce(_payment_method_id, _p.payment_method_id), _p.category_id, _p.id, _when, (select auth.uid()));
end;
$$;
