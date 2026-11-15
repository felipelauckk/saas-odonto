-- Etapa 16: CRC — central de relacionamento.
--
--  * As filas são calculadas na hora (função crc_items), com a permissão de
--    quem consulta (security invoker): o item some sozinho quando o motivo se
--    resolve (agendou, aprovou, pagou).
--  * crc_contacts guarda cada contato (ligação, WhatsApp, resultado e próximo
--    contato). É um registro: não se edita nem se apaga pelo app.
--  * crc_templates: mensagem pronta de WhatsApp por fila.
--  * Só a recepção e a gestão usam a CRC (dentista não).

create type public.crc_queue as enum (
  'open_quotes', 'no_shows', 'first_visit_no_shows', 'untreated', 'overdue_returns', 'birthdays', 'overdue_payments'
);
create type public.crc_channel as enum ('call', 'whatsapp', 'other');
create type public.crc_outcome as enum ('no_answer', 'thinking', 'scheduled', 'not_interested');

create function public.can_use_crc()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('owner', 'manager', 'receptionist');
$$;
revoke execute on function public.can_use_crc() from public, anon;
grant execute on function public.can_use_crc() to authenticated;

create table public.crc_contacts (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  patient_id uuid not null,
  queue public.crc_queue not null,
  -- Identifica o item da fila (ex.: plan:<id>, appt:<id>, bday:<paciente>:<ano>).
  item_key text not null check (length(item_key) <= 120),
  ref_id uuid,
  channel public.crc_channel not null,
  outcome public.crc_outcome,
  notes text check (length(notes) <= 500),
  next_contact_on date,
  amount_cents integer check (amount_cents >= 0),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (patient_id, clinic_id) references public.patients (id, clinic_id) on delete restrict
);
create index crc_contacts_item_idx on public.crc_contacts (clinic_id, queue, item_key, created_at desc);
create index crc_contacts_created_idx on public.crc_contacts (clinic_id, created_at);

create table public.crc_templates (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  queue public.crc_queue not null,
  body text not null check (length(trim(body)) > 0 and length(body) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, queue)
);

do $$
declare
  _table text;
begin
  foreach _table in array array['crc_contacts', 'crc_templates'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', _table || '_set_updated_at', _table);
    execute format('create trigger %I before insert or update or delete on public.%I for each row execute function public.enforce_clinic_writable()', _table || '_enforce_writable', _table);
  end loop;
end;
$$;

alter table public.crc_contacts enable row level security;
alter table public.crc_templates enable row level security;
revoke all on public.crc_contacts, public.crc_templates from anon, authenticated;

grant select on public.crc_contacts to authenticated;
grant insert (clinic_id, patient_id, queue, item_key, ref_id, channel, outcome, notes, next_contact_on, amount_cents, created_by)
  on public.crc_contacts to authenticated;
create policy "crc: recepção e gestão leem" on public.crc_contacts for select to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.can_use_crc()));
create policy "crc: recepção e gestão registram" on public.crc_contacts for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and (select public.can_use_crc()) and created_by = (select auth.uid()));

grant select on public.crc_templates to authenticated;
grant update (body) on public.crc_templates to authenticated;
create policy "crc modelos: recepção e gestão leem" on public.crc_templates for select to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.can_use_crc()));
create policy "crc modelos: gestão edita" on public.crc_templates for update to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')))
  with check (clinic_id = (select public.current_clinic_id()));

-- Filas -------------------------------------------------------------------------------------

create function public.crc_items()
returns table (
  queue public.crc_queue,
  item_key text,
  patient_id uuid,
  patient_name text,
  phone text,
  ref_id uuid,
  amount_cents integer,
  ref_date date
)
language sql
stable
security invoker
set search_path = ''
as $$
  with today as (
    select (now() at time zone 'America/Sao_Paulo')::date as d
  ),
  booked as (
    -- Pacientes com consulta futura marcada.
    select distinct a.patient_id from public.appointments a
    where a.starts_at > now() and a.status not in ('canceled', 'no_show')
  ),
  items as (
    -- Orçamentos apresentados, nem aprovados nem recusados.
    select 'open_quotes'::public.crc_queue as queue, 'plan:' || p.id as item_key, p.patient_id, p.id as ref_id,
           p.total_cents as amount_cents, (coalesce(p.presented_at, p.updated_at) at time zone 'America/Sao_Paulo')::date as ref_date
    from public.treatment_plans p
    where p.status = 'presented'

    union all
    -- Última falta do paciente (90 dias), sem nenhuma consulta marcada depois dela.
    select case when ns.is_first_visit then 'first_visit_no_shows' else 'no_shows' end::public.crc_queue,
           'appt:' || ns.id, ns.patient_id, ns.id, null::integer, (ns.starts_at at time zone 'America/Sao_Paulo')::date
    from (
      select distinct on (a.patient_id) a.id, a.patient_id, a.starts_at, a.is_first_visit
      from public.appointments a
      where a.status = 'no_show' and a.starts_at > now() - interval '90 days'
      order by a.patient_id, a.starts_at desc
    ) ns
    where not exists (
      select 1 from public.appointments b
      where b.patient_id = ns.patient_id and b.starts_at > ns.starts_at and b.status not in ('canceled', 'no_show')
    )

    union all
    -- Tratamento aprovado com itens a fazer e nenhuma consulta futura.
    select 'untreated'::public.crc_queue, 'plan:' || p.id, p.patient_id, p.id,
           sum(i.price_cents)::integer, (p.approved_at at time zone 'America/Sao_Paulo')::date
    from public.treatment_plans p
    join public.treatment_items i on i.plan_id = p.id and i.status = 'approved'
    where p.status in ('approved', 'partially_approved')
      and p.patient_id not in (select patient_id from booked)
    group by p.id

    union all
    -- Retornos vencidos sem consulta marcada.
    select 'overdue_returns'::public.crc_queue, 'return:' || r.id, r.patient_id, r.id, null::integer, r.due_date
    from public.patient_returns r, today
    where r.status = 'pending' and r.due_date <= today.d
      and r.patient_id not in (select patient_id from booked)

    union all
    -- Aniversário hoje e nos próximos 7 dias.
    select 'birthdays'::public.crc_queue, 'bday:' || b.id || ':' || extract(year from b.next_birthday)::int, b.id, null::uuid, null::integer, b.next_birthday
    from (
      select pt.id,
             case when this_year.d < today.d then (this_year.d + interval '1 year')::date else this_year.d end as next_birthday
      from public.patients pt
      cross join today
      cross join lateral (
        select (pt.birth_date + make_interval(years => extract(year from today.d)::int - extract(year from pt.birth_date)::int))::date as d
      ) this_year
      where pt.birth_date is not null and pt.archived_at is null
    ) b, today
    where b.next_birthday between today.d and today.d + 7

    union all
    -- Parcelas vencidas, somadas por paciente.
    select 'overdue_payments'::public.crc_queue, 'debt:' || r.patient_id || ':' || min(r.due_date), r.patient_id, null::uuid,
           sum(r.amount_cents)::integer, min(r.due_date)
    from public.receivables r, today
    where r.status in ('open', 'overdue') and r.due_date < today.d
    group by r.patient_id
  )
  select i.queue, i.item_key, i.patient_id, pt.full_name, coalesce(pt.whatsapp, pt.phone), i.ref_id, i.amount_cents, i.ref_date
  from items i
  join public.patients pt on pt.id = i.patient_id
  where pt.archived_at is null and (select public.can_use_crc());
$$;
revoke execute on function public.crc_items() from public, anon;
grant execute on function public.crc_items() to authenticated;

-- Indicadores: por fila, quantos itens foram contatados no período e quantos se
-- resolveram depois do primeiro contato (e o valor recuperado).
create function public.crc_stats(_from date, _to date)
returns table (queue public.crc_queue, contacted integer, recovered integer, recovered_cents bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with firsts as (
    select c.queue, c.item_key, c.patient_id, (array_agg(c.ref_id order by c.created_at))[1] as ref_id,
           min(c.created_at) as first_at, max(c.amount_cents) as amount_cents
    from public.crc_contacts c
    where (c.created_at at time zone 'America/Sao_Paulo')::date between _from and _to
    group by c.queue, c.item_key, c.patient_id
  ),
  judged as (
    select f.queue,
           case f.queue
             when 'open_quotes' then exists (
               select 1 from public.treatment_plans p
               where p.id = f.ref_id and p.status in ('approved', 'partially_approved', 'completed') and p.approved_at >= f.first_at)
             when 'overdue_payments' then exists (
               select 1 from public.receivables r
               where r.patient_id = f.patient_id and r.status = 'paid' and r.paid_at >= f.first_at and r.due_date < (f.first_at at time zone 'America/Sao_Paulo')::date)
             when 'birthdays' then false
             else exists (
               select 1 from public.appointments a
               where a.patient_id = f.patient_id and a.created_at >= f.first_at and a.status not in ('canceled', 'no_show'))
           end as ok,
           case f.queue
             when 'open_quotes' then (select p.total_cents from public.treatment_plans p where p.id = f.ref_id)
             when 'overdue_payments' then (
               select sum(coalesce(r.paid_amount_cents, r.amount_cents)) from public.receivables r
               where r.patient_id = f.patient_id and r.status = 'paid' and r.paid_at >= f.first_at and r.due_date < (f.first_at at time zone 'America/Sao_Paulo')::date)
             else f.amount_cents
           end as value
    from firsts f
  )
  select j.queue, count(*)::int, count(*) filter (where j.ok)::int, coalesce(sum(j.value) filter (where j.ok), 0)::bigint
  from judged j
  where (select public.can_use_crc())
  group by j.queue;
$$;
revoke execute on function public.crc_stats(date, date) from public, anon;
grant execute on function public.crc_stats(date, date) to authenticated;

-- Modelos padrão ---------------------------------------------------------------------------

create function public.seed_crc_defaults(_clinic_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.crc_templates (clinic_id, queue, body) values
    (_clinic_id, 'open_quotes', 'Olá, {{paciente}}! Aqui é da {{clinica}}. Ficou alguma dúvida sobre o seu orçamento? Podemos ajudar a encontrar a melhor forma de começar o tratamento.'),
    (_clinic_id, 'no_shows', 'Olá, {{paciente}}! Sentimos sua falta na consulta na {{clinica}}. Vamos marcar um novo horário?'),
    (_clinic_id, 'first_visit_no_shows', 'Olá, {{paciente}}! Sentimos sua falta na sua avaliação na {{clinica}}. Quer escolher um novo horário?'),
    (_clinic_id, 'untreated', 'Olá, {{paciente}}! Aqui é da {{clinica}}. Seu tratamento ainda tem etapas a fazer. Vamos agendar a próxima?'),
    (_clinic_id, 'overdue_returns', 'Olá, {{paciente}}! Está na hora do seu retorno na {{clinica}}. Qual o melhor dia para você?'),
    (_clinic_id, 'birthdays', 'Feliz aniversário, {{paciente}}! A equipe da {{clinica}} deseja um ótimo dia.'),
    (_clinic_id, 'overdue_payments', 'Olá, {{paciente}}! Aqui é da {{clinica}}. Consta em aberto o valor de {{valor}}. Podemos ajudar com a forma de pagamento?')
  on conflict (clinic_id, queue) do nothing;
$$;
revoke execute on function public.seed_crc_defaults(uuid) from public, anon, authenticated;

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
  return null;
end;
$$;

select public.seed_crc_defaults(id) from public.clinics;
