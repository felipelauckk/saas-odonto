-- Lista de pacientes do redesign (R6): colunas de situação e filtros em pílulas.
-- Security invoker: cada coluna respeita a RLS de quem consulta (o dentista,
-- por exemplo, só soma as cobranças que já pode ver).
--
-- Situações (um paciente pode estar em mais de uma):
--   in_treatment   orçamento aprovado (total ou em parte) com item aprovado ainda não feito
--   open_quote     orçamento apresentado, esperando resposta
--   return_overdue retorno pendente com data já passada
--   birthday       faz aniversário no mês corrente
-- Datas no fuso de São Paulo.

create function public.patient_list(
  _query text default '',
  _segment text default 'active',
  _source public.patient_source default null,
  _limit integer default 25,
  _offset integer default 0
)
returns table (
  id uuid,
  full_name text,
  cpf text,
  birth_date date,
  phone text,
  whatsapp text,
  source public.patient_source,
  archived_at timestamptz,
  last_visit_at timestamptz,
  next_visit_at timestamptz,
  open_cents bigint,
  overdue_cents bigint,
  in_treatment boolean,
  open_quote boolean,
  return_overdue boolean,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select
      lower(public.immutable_unaccent(trim(coalesce(_query, '')))) as q,
      regexp_replace(coalesce(_query, ''), '\D', '', 'g') as digits,
      (now() at time zone 'America/Sao_Paulo')::date as today
  ),
  base as (
    select
      p.*,
      exists (
        select 1 from public.treatment_plans tp
        join public.treatment_items ti on ti.plan_id = tp.id
        where tp.patient_id = p.id and tp.status in ('approved', 'partially_approved') and ti.status = 'approved'
      ) as in_treatment,
      exists (
        select 1 from public.treatment_plans tp where tp.patient_id = p.id and tp.status = 'presented'
      ) as open_quote,
      exists (
        select 1 from public.patient_returns r, params
        where r.patient_id = p.id and r.status = 'pending' and r.due_date < params.today
      ) as return_overdue
    from public.patients p, params
    where
      (
        (_segment = 'archived' and p.archived_at is not null)
        or (_segment <> 'archived' and p.archived_at is null)
      )
      and (_source is null or p.source = _source)
      and (
        params.q = ''
        or p.search_name like '%' || params.q || '%'
        or (length(params.digits) >= 3 and (
          p.cpf like params.digits || '%'
          or p.phone like '%' || params.digits || '%'
          or p.whatsapp like '%' || params.digits || '%'
        ))
      )
  ),
  filtered as (
    select b.*, count(*) over () as total_count
    from base b, params
    where
      _segment in ('active', 'archived')
      or (_segment = 'in_treatment' and b.in_treatment)
      or (_segment = 'open_quote' and b.open_quote)
      or (_segment = 'return_overdue' and b.return_overdue)
      or (_segment = 'birthday' and extract(month from b.birth_date) = extract(month from params.today))
    order by b.search_name, b.id
    limit least(greatest(_limit, 1), 100)
    offset greatest(_offset, 0)
  )
  select
    f.id, f.full_name, f.cpf, f.birth_date, f.phone, f.whatsapp, f.source, f.archived_at,
    (select max(a.starts_at) from public.appointments a
      where a.patient_id = f.id and a.status = 'done' and a.starts_at < now()) as last_visit_at,
    (select min(a.starts_at) from public.appointments a
      where a.patient_id = f.id and a.starts_at >= now() and a.status not in ('canceled', 'no_show', 'done')) as next_visit_at,
    coalesce((select sum(r.amount_cents) from public.receivables r
      where r.patient_id = f.id and r.status in ('open', 'overdue')), 0)::bigint as open_cents,
    coalesce((select sum(r.amount_cents) from public.receivables r
      where r.patient_id = f.id and r.status = 'overdue'), 0)::bigint as overdue_cents,
    f.in_treatment, f.open_quote, f.return_overdue, f.total_count
  from filtered f
  order by f.search_name, f.id;
$$;

-- Quantos pacientes há em cada pílula (mesma busca e origem da lista).
create function public.patient_segment_counts(
  _query text default '',
  _source public.patient_source default null
)
returns table (
  active bigint,
  in_treatment bigint,
  open_quote bigint,
  return_overdue bigint,
  birthday bigint,
  archived bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select
      lower(public.immutable_unaccent(trim(coalesce(_query, '')))) as q,
      regexp_replace(coalesce(_query, ''), '\D', '', 'g') as digits,
      (now() at time zone 'America/Sao_Paulo')::date as today
  ),
  base as (
    select p.id, p.archived_at, p.birth_date
    from public.patients p, params
    where
      (_source is null or p.source = _source)
      and (
        params.q = ''
        or p.search_name like '%' || params.q || '%'
        or (length(params.digits) >= 3 and (
          p.cpf like params.digits || '%'
          or p.phone like '%' || params.digits || '%'
          or p.whatsapp like '%' || params.digits || '%'
        ))
      )
  )
  select
    count(*) filter (where b.archived_at is null),
    count(*) filter (where b.archived_at is null and exists (
      select 1 from public.treatment_plans tp
      join public.treatment_items ti on ti.plan_id = tp.id
      where tp.patient_id = b.id and tp.status in ('approved', 'partially_approved') and ti.status = 'approved'
    )),
    count(*) filter (where b.archived_at is null and exists (
      select 1 from public.treatment_plans tp where tp.patient_id = b.id and tp.status = 'presented'
    )),
    count(*) filter (where b.archived_at is null and exists (
      select 1 from public.patient_returns r
      where r.patient_id = b.id and r.status = 'pending' and r.due_date < params.today
    )),
    count(*) filter (where b.archived_at is null and extract(month from b.birth_date) = extract(month from params.today)),
    count(*) filter (where b.archived_at is not null)
  from base b, params;
$$;

revoke execute on function public.patient_list(text, text, public.patient_source, integer, integer) from public, anon;
grant execute on function public.patient_list(text, text, public.patient_source, integer, integer) to authenticated;
revoke execute on function public.patient_segment_counts(text, public.patient_source) from public, anon;
grant execute on function public.patient_segment_counts(text, public.patient_source) to authenticated;
