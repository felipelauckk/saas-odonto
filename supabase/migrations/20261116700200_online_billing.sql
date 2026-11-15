-- Etapa 19: cobrança online ao paciente (conta Asaas da própria clínica) e
-- régua de cobrança.
--
--  * clinic_billing: chave de API da clínica CRIPTOGRAFADA pelo servidor
--    (AES-256-GCM com segredo fora do banco). A coluna da chave não é legível
--    pelo app; só o servidor (service role) lê. O token do webhook identifica a
--    clínica nas notificações do Asaas.
--  * patient_charges: cobrança (Pix, boleto ou link) de uma ou mais parcelas.
--  * settle_online_charge: baixa automática chamada só pelo webhook (service
--    role), com a taxa real e lançamento no caixa.
--  * Régua: etapas (dias antes/depois do vencimento) com texto; envio uma vez
--    por parcela e etapa; parcela em negociação ou paga não recebe.

create table public.clinic_billing (
  clinic_id uuid primary key references public.clinics (id) on delete restrict,
  environment text not null default 'sandbox' check (environment in ('sandbox', 'production')),
  api_key_encrypted text,
  api_key_hint text check (length(api_key_hint) <= 8),
  webhook_token text not null default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index clinic_billing_webhook_token_key on public.clinic_billing (webhook_token);

alter table public.patients add column asaas_customer_id text;
alter table public.receivables add column in_negotiation boolean not null default false;
grant update (in_negotiation) on public.receivables to authenticated;

create type public.charge_kind as enum ('pix', 'boleto', 'link');
create type public.charge_status as enum ('pending', 'paid', 'overdue', 'canceled', 'refunded');

create table public.patient_charges (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  patient_id uuid not null,
  receivable_ids uuid[] not null check (cardinality(receivable_ids) between 1 and 60),
  kind public.charge_kind not null,
  amount_cents integer not null check (amount_cents > 0),
  due_date date not null,
  installments smallint not null default 1 check (installments between 1 and 12),
  status public.charge_status not null default 'pending',
  asaas_payment_id text,
  asaas_installment_id text,
  invoice_url text,
  bank_slip_url text,
  pix_payload text,
  paid_at timestamptz,
  paid_cents integer,
  fee_cents integer,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (patient_id, clinic_id) references public.patients (id, clinic_id) on delete restrict
);
create index patient_charges_clinic_idx on public.patient_charges (clinic_id, status);
create index patient_charges_receivables_idx on public.patient_charges using gin (receivable_ids);

create table public.dunning_steps (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  offset_days smallint not null check (offset_days between -30 and 90),
  body text not null check (length(trim(body)) > 0 and length(body) <= 1000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, offset_days)
);

create table public.dunning_log (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  receivable_id uuid not null references public.receivables (id) on delete cascade,
  offset_days smallint not null,
  status text not null,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (receivable_id, offset_days)
);

do $$
declare
  _table text;
begin
  foreach _table in array array['clinic_billing', 'patient_charges', 'dunning_steps', 'dunning_log'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', _table || '_set_updated_at', _table);
    execute format('create trigger %I before insert or update or delete on public.%I for each row execute function public.enforce_clinic_writable()', _table || '_enforce_writable', _table);
  end loop;
end;
$$;

-- Permissões ---------------------------------------------------------------------------------

alter table public.clinic_billing enable row level security;
alter table public.patient_charges enable row level security;
alter table public.dunning_steps enable row level security;
alter table public.dunning_log enable row level security;
revoke all on public.clinic_billing, public.patient_charges, public.dunning_steps, public.dunning_log from anon, authenticated;

-- A chave criptografada nunca sai para o app: só colunas não sensíveis.
grant select (clinic_id, environment, api_key_hint, webhook_token, connected_at) on public.clinic_billing to authenticated;
create policy "cobrança online: gestão vê a conexão" on public.clinic_billing for select to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')));

grant select on public.patient_charges to authenticated;
grant insert (clinic_id, patient_id, receivable_ids, kind, amount_cents, due_date, installments, asaas_payment_id, asaas_installment_id, invoice_url, bank_slip_url, pix_payload, created_by)
  on public.patient_charges to authenticated;
create policy "cobranças: quem opera o financeiro lê" on public.patient_charges for select to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.can_operate_finance()));
create policy "cobranças: quem opera o financeiro cria" on public.patient_charges for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and (select public.can_operate_finance()) and created_by = (select auth.uid()));

grant select on public.dunning_steps to authenticated;
grant insert (clinic_id, offset_days, body, active) on public.dunning_steps to authenticated;
grant update (body, active) on public.dunning_steps to authenticated;
grant delete on public.dunning_steps to authenticated;
create policy "régua: quem opera lê" on public.dunning_steps for select to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.can_operate_finance()));
create policy "régua: gestão cria" on public.dunning_steps for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')));
create policy "régua: gestão edita" on public.dunning_steps for update to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')))
  with check (clinic_id = (select public.current_clinic_id()));
create policy "régua: gestão apaga" on public.dunning_steps for delete to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')));

grant select on public.dunning_log to authenticated;
create policy "régua log: quem opera lê" on public.dunning_log for select to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.can_operate_finance()));

-- Baixa automática (webhook) -------------------------------------------------------------------

create function public.settle_online_charge(_charge_id uuid, _paid_cents integer, _fee_cents integer, _paid_on date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _c public.patient_charges;
  _method uuid;
  _when timestamptz;
  _total integer;
  _r record;
  _fee_left integer := greatest(coalesce(_fee_cents, 0), 0);
  _paid_left integer := _paid_cents;
  _n integer;
  _i integer := 0;
  _fee integer;
  _paid integer;
  _patient text;
begin
  select * into _c from public.patient_charges where id = _charge_id for update;
  if not found or _c.status = 'paid' then
    return; -- desconhecida ou já baixada (webhook repetido)
  end if;

  select id into _method from public.payment_methods where clinic_id = _c.clinic_id and name = 'Cobrança online';
  if _method is null then
    insert into public.payment_methods (clinic_id, name, fee_percent, days_to_receive, active)
    values (_c.clinic_id, 'Cobrança online', 0, 0, false) returning id into _method;
  end if;

  _when := case when _paid_on is null or _paid_on >= public.today_sp() then now()
                else (_paid_on + time '12:00') at time zone 'America/Sao_Paulo' end;
  select full_name into _patient from public.patients where id = _c.patient_id;
  select coalesce(sum(amount_cents), 0)::int, count(*)::int into _total, _n
    from public.receivables where id = any(_c.receivable_ids) and status in ('open', 'overdue');

  for _r in
    select * from public.receivables
     where id = any(_c.receivable_ids) and status in ('open', 'overdue')
     order by due_date, installment_number
     for update
  loop
    _i := _i + 1;
    -- Rateio pelo valor de cada parcela; a última leva o resto.
    if _i = _n then
      _paid := _paid_left;
      _fee := _fee_left;
    else
      _paid := round(_paid_cents::numeric * _r.amount_cents / nullif(_total, 0));
      _fee := round(coalesce(_fee_cents, 0)::numeric * _r.amount_cents / nullif(_total, 0));
    end if;
    _paid_left := _paid_left - _paid;
    _fee_left := _fee_left - _fee;

    update public.receivables
       set status = 'paid', paid_at = _when, paid_amount_cents = _paid, fee_cents = _fee,
           payment_method_id = _method, in_negotiation = false
     where id = _r.id;
    insert into public.cash_movements (clinic_id, unit_id, type, amount_cents, description, receivable_id, payment_method_id, occurred_at)
    values (_r.clinic_id, _r.unit_id, 'in', _paid, 'Cobrança online: ' || _patient || ' — ' || _r.description, _r.id, _method, _when);
  end loop;

  update public.patient_charges
     set status = 'paid', paid_at = _when, paid_cents = _paid_cents, fee_cents = coalesce(_fee_cents, 0)
   where id = _charge_id;
end;
$$;
revoke execute on function public.settle_online_charge(uuid, integer, integer, date) from public, anon, authenticated;

-- Régua padrão -----------------------------------------------------------------------------------

create function public.seed_dunning_defaults(_clinic_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.dunning_steps (clinic_id, offset_days, body) values
    (_clinic_id, -3, 'Olá, {{paciente}}! Lembrete da {{clinica}}: a parcela de {{valor}} vence em {{vencimento}}. {{link}}'),
    (_clinic_id, 0, 'Olá, {{paciente}}! A parcela de {{valor}} com a {{clinica}} vence hoje. {{link}}'),
    (_clinic_id, 1, 'Olá, {{paciente}}! Não identificamos o pagamento da parcela de {{valor}} que venceu em {{vencimento}}. {{link}}'),
    (_clinic_id, 3, 'Olá, {{paciente}}! A parcela de {{valor}} (vencida em {{vencimento}}) continua em aberto. Podemos ajudar? {{link}}'),
    (_clinic_id, 7, 'Olá, {{paciente}}. A parcela de {{valor}} está em atraso desde {{vencimento}}. Fale com a {{clinica}} para combinarmos. {{link}}'),
    (_clinic_id, 15, 'Olá, {{paciente}}. A parcela de {{valor}} segue em aberto desde {{vencimento}}. Por favor, entre em contato com a {{clinica}}. {{link}}')
  on conflict (clinic_id, offset_days) do nothing;
$$;
revoke execute on function public.seed_dunning_defaults(uuid) from public, anon, authenticated;

create or replace function public.on_clinic_created_seed_documents()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_document_defaults(new.id);
  perform public.seed_finance_defaults(new.id);
  perform public.seed_agenda_defaults(new.id);
  perform public.seed_crc_defaults(new.id);
  perform public.seed_crm_defaults(new.id);
  perform public.seed_dunning_defaults(new.id);
  return null;
end;
$$;

select public.seed_dunning_defaults(id) from public.clinics;
