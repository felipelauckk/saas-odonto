-- Fase 3, P7: crédito do paciente (saldo a favor) e mensalidades.
--
-- Crédito: cada movimento é registro (não se edita nem apaga). O saldo é a
-- soma e nunca fica negativo: todo movimento passa por funções do banco que
-- conferem o saldo com a linha do paciente travada.
--   entrada: pagamento a mais guardado como crédito ou lançamento da gestão (+)
--   uso:     parcela paga com o crédito (-)
--   estorno: desfaz um uso (+) ou uma entrada (-) quando o pagamento é estornado
--
-- Mensalidades: a rotina diária gera a parcela do mês seguinte (uma por mês e
-- por mensalidade); ela entra em contas a receber como qualquer parcela.

-- Crédito --------------------------------------------------------------------------------

create table public.patient_credits (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  patient_id uuid not null,
  amount_cents integer not null check (amount_cents <> 0),
  kind text not null check (kind in ('entrada', 'uso', 'estorno')),
  receivable_id uuid references public.receivables (id) on delete restrict,
  payment_id uuid,
  notes text check (length(notes) <= 300),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'entrada' and amount_cents > 0) or (kind = 'uso' and amount_cents < 0) or kind = 'estorno'),
  foreign key (patient_id, clinic_id) references public.patients (id, clinic_id) on delete restrict
);

create index patient_credits_patient_idx on public.patient_credits (patient_id, created_at desc);
create index patient_credits_receivable_idx on public.patient_credits (receivable_id) where receivable_id is not null;

create trigger patient_credits_set_updated_at
  before update on public.patient_credits
  for each row execute function public.set_updated_at();

alter table public.patient_credits enable row level security;
revoke all on public.patient_credits from anon, authenticated;
grant select on public.patient_credits to authenticated;

-- Leitura: quem opera o financeiro. Escrita: só pelas funções abaixo.
create policy "crédito: financeiro lê" on public.patient_credits for select to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.can_operate_finance()));

create trigger patient_credits_enforce_writable before insert or update or delete on public.patient_credits
  for each row execute function public.enforce_clinic_writable();

-- Saldo do paciente (quem opera o financeiro).
create function public.patient_credit_balance(_patient_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(amount_cents), 0)::integer
  from public.patient_credits
  where patient_id = _patient_id
    and clinic_id = public.current_clinic_id()
    and public.can_operate_finance();
$$;
revoke execute on function public.patient_credit_balance(uuid) from public, anon;
grant execute on function public.patient_credit_balance(uuid) to authenticated;

-- Movimento com o saldo conferido (paciente travado para não haver corrida).
create function public.move_patient_credit(_clinic_id uuid, _patient_id uuid, _amount integer, _kind text, _receivable_id uuid, _notes text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _balance integer;
begin
  perform 1 from public.patients where id = _patient_id and clinic_id = _clinic_id for update;
  if not found then
    raise exception 'Paciente não encontrado.' using errcode = 'P0002';
  end if;
  select coalesce(sum(amount_cents), 0) into _balance from public.patient_credits where patient_id = _patient_id;
  if _balance + _amount < 0 then
    raise exception 'Crédito insuficiente: o saldo é de R$ %.', to_char(_balance / 100.0, 'FM999G999G990D00') using errcode = 'OF020';
  end if;
  insert into public.patient_credits (clinic_id, patient_id, amount_cents, kind, receivable_id, notes, created_by)
  values (_clinic_id, _patient_id, _amount, _kind, _receivable_id, nullif(trim(_notes), ''), auth.uid());
end;
$$;
revoke execute on function public.move_patient_credit(uuid, uuid, integer, text, uuid, text) from public, anon, authenticated;

-- Lançamento manual (só a gestão).
create function public.add_patient_credit(_patient_id uuid, _amount_cents integer, _notes text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_role('owner', 'manager') then
    raise exception 'Só a gestão lança crédito manual.' using errcode = '42501';
  end if;
  if _amount_cents is null or _amount_cents <= 0 then
    raise exception 'Informe o valor do crédito.' using errcode = 'OF021';
  end if;
  perform public.move_patient_credit(public.current_clinic_id(), _patient_id, _amount_cents, 'entrada', null, coalesce(_notes, 'Lançamento manual'));
end;
$$;
revoke execute on function public.add_patient_credit(uuid, integer, text) from public, anon;
grant execute on function public.add_patient_credit(uuid, integer, text) to authenticated;

-- Baixa com o valor a mais guardado como crédito (o caixa recebe o total).
create function public.receive_payment_with_credit(
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
begin
  perform public.receive_payment(_receivable_id, _paid_amount_cents, _payment_method_id, _paid_on);
  select * into _r from public.receivables where id = _receivable_id;
  if _paid_amount_cents > _r.amount_cents then
    perform public.move_patient_credit(_r.clinic_id, _r.patient_id, _paid_amount_cents - _r.amount_cents, 'entrada', _receivable_id, 'Pagamento a mais');
  end if;
end;
$$;
revoke execute on function public.receive_payment_with_credit(uuid, integer, uuid, date) from public, anon;
grant execute on function public.receive_payment_with_credit(uuid, integer, uuid, date) to authenticated;

-- Pagar a parcela com o crédito (o dinheiro já entrou no caixa antes).
create function public.use_patient_credit(_receivable_id uuid, _paid_on date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _r public.receivables;
  _when timestamptz;
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
  if _paid_on is null or _paid_on > public.today_sp() then
    raise exception 'A data do pagamento não pode ser no futuro.' using errcode = 'OF003';
  end if;
  perform public.move_patient_credit(_r.clinic_id, _r.patient_id, -_r.amount_cents, 'uso', _receivable_id, null);
  _when := case when _paid_on = public.today_sp() then now()
                else (_paid_on + time '12:00') at time zone 'America/Sao_Paulo' end;
  update public.receivables
     set status = 'paid', paid_at = _when, paid_amount_cents = _r.amount_cents, fee_cents = 0,
         payment_method_id = null, received_by = (select auth.uid())
   where id = _receivable_id;
end;
$$;
revoke execute on function public.use_patient_credit(uuid, date) from public, anon;
grant execute on function public.use_patient_credit(uuid, date) to authenticated;

-- Estorno: o que foi pago com crédito volta ao crédito (sem saída de caixa);
-- o crédito gerado por pagamento a mais sai do saldo (se ainda não foi usado).
create or replace function public.reverse_payment(_receivable_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _r public.receivables;
  _used integer;
  _stored integer;
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

  select coalesce(sum(amount_cents) filter (where kind = 'uso' or (kind = 'estorno' and amount_cents > 0)), 0),
         coalesce(sum(amount_cents) filter (where kind = 'entrada' or (kind = 'estorno' and amount_cents < 0)), 0)
    into _used, _stored
    from public.patient_credits where receivable_id = _receivable_id;

  if _used < 0 then
    -- Pago com crédito: devolve o crédito, sem mexer no caixa.
    perform public.move_patient_credit(_r.clinic_id, _r.patient_id, -_used, 'estorno', _receivable_id, 'Estorno do pagamento com crédito');
  else
    if _stored > 0 then
      perform public.move_patient_credit(_r.clinic_id, _r.patient_id, -_stored, 'estorno', _receivable_id, 'Estorno do pagamento a mais');
    end if;
    insert into public.cash_movements (clinic_id, unit_id, type, amount_cents, description, receivable_id, payment_method_id, created_by)
    values (_r.clinic_id, _r.unit_id, 'out', _r.paid_amount_cents, 'Estorno: ' || _r.description, _r.id, _r.payment_method_id, (select auth.uid()));
  end if;

  update public.receivables
     set status = case when due_date < public.today_sp() then 'overdue'::public.receivable_status else 'open'::public.receivable_status end,
         paid_at = null, paid_amount_cents = null, fee_cents = 0, received_by = null
   where id = _receivable_id;
end;
$$;

-- Mensalidades ------------------------------------------------------------------------------

create table public.patient_subscriptions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  unit_id uuid not null,
  patient_id uuid not null,
  description text not null check (length(trim(description)) between 2 and 120),
  amount_cents integer not null check (amount_cents > 0),
  due_day integer not null check (due_day between 1 and 28),
  starts_on date not null,
  ends_on date,
  active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on),
  unique (id, clinic_id),
  foreign key (patient_id, clinic_id) references public.patients (id, clinic_id) on delete restrict,
  foreign key (unit_id, clinic_id) references public.units (id, clinic_id) on delete restrict
);

create index patient_subscriptions_patient_idx on public.patient_subscriptions (patient_id);

create trigger patient_subscriptions_set_updated_at
  before update on public.patient_subscriptions
  for each row execute function public.set_updated_at();

alter table public.patient_subscriptions enable row level security;
revoke all on public.patient_subscriptions from anon, authenticated;
grant select on public.patient_subscriptions to authenticated;
grant insert (clinic_id, unit_id, patient_id, description, amount_cents, due_day, starts_on, ends_on) on public.patient_subscriptions to authenticated;
-- Encerrar: só "active" e "ends_on". Valor e dia não mudam (encerra e cria outra).
grant update (active, ends_on) on public.patient_subscriptions to authenticated;

create policy "mensalidades: financeiro lê" on public.patient_subscriptions for select to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.can_operate_finance()));
create policy "mensalidades: financeiro cria" on public.patient_subscriptions for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and (select public.can_operate_finance()) and (select public.can_access_unit(unit_id)));
create policy "mensalidades: financeiro encerra" on public.patient_subscriptions for update to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.can_operate_finance()))
  with check (clinic_id = (select public.current_clinic_id()));

create trigger patient_subscriptions_enforce_writable before insert or update or delete on public.patient_subscriptions
  for each row execute function public.enforce_clinic_writable();

alter table public.receivables
  add column subscription_id uuid,
  add column competence date,
  add constraint receivables_subscription_fk foreign key (subscription_id, clinic_id)
    references public.patient_subscriptions (id, clinic_id) on delete restrict,
  add constraint receivables_competence_check check (subscription_id is null or (competence is not null and extract(day from competence) = 1));

create unique index receivables_subscription_competence_key on public.receivables (subscription_id, competence) where subscription_id is not null;

-- Gera as parcelas que faltam até o mês seguinte (todas as mensalidades ativas, ou só uma).
create function public.generate_subscription_receivables(_subscription_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  _s public.patient_subscriptions;
  _month date;
  _last date := (date_trunc('month', public.today_sp()) + interval '1 month')::date;
  _count integer := 0;
  _due date;
begin
  for _s in
    select * from public.patient_subscriptions
    where active
      and (_subscription_id is null or id = _subscription_id)
  loop
    _month := date_trunc('month', _s.starts_on)::date;
    while _month <= _last loop
      _due := _month + (_s.due_day - 1);
      exit when _s.ends_on is not null and _due > _s.ends_on;
      if _due >= _s.starts_on then
        insert into public.receivables (clinic_id, unit_id, patient_id, description, amount_cents, due_date, installment_number, installment_total, subscription_id, competence, created_by)
        values (_s.clinic_id, _s.unit_id, _s.patient_id,
                'Mensalidade ' || _s.description || ' (' || to_char(_month, 'MM/YYYY') || ')',
                _s.amount_cents, _due, 1, 1, _s.id, _month, _s.created_by)
        on conflict (subscription_id, competence) where subscription_id is not null do nothing;
        if found then
          _count := _count + 1;
        end if;
      end if;
      _month := (_month + interval '1 month')::date;
    end loop;
  end loop;
  return _count;
end;
$$;
revoke execute on function public.generate_subscription_receivables(uuid) from public, anon, authenticated;

-- Chamada pelo app ao criar a mensalidade (confere a clínica de quem chama).
create function public.generate_my_subscription_receivables(_subscription_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_operate_finance()
     or not exists (select 1 from public.patient_subscriptions where id = _subscription_id and clinic_id = public.current_clinic_id()) then
    raise exception 'Mensalidade não encontrada.' using errcode = 'P0002';
  end if;
  return public.generate_subscription_receivables(_subscription_id);
end;
$$;
revoke execute on function public.generate_my_subscription_receivables(uuid) from public, anon;
grant execute on function public.generate_my_subscription_receivables(uuid) to authenticated;

select cron.schedule('gerar-mensalidades', '15 3 * * *', 'select public.generate_subscription_receivables()');
