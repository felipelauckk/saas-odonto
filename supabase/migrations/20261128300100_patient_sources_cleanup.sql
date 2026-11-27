-- Fase 3, P4 (limpeza): as origens antigas (enums patient_source e
-- lead_source) saem. A lista patient_sources (migration 20261128200100) é a
-- única fonte; o código novo não lê nem grava mais as colunas "source".
-- Aplicada depois que o código novo estiver no ar.

-- Garantia: o que o código antigo gravou no intervalo ganha a origem nova.
update public.patients p set source_id = s.id
from public.patient_sources s
where p.source is not null and p.source_id is null and s.clinic_id = p.clinic_id and s.key = public.legacy_source_key(p.source::text);

update public.leads l set source_id = s.id
from public.patient_sources s
where l.source_id is null and s.clinic_id = l.clinic_id and s.key = public.legacy_source_key(l.source::text);

update public.crm_campaigns c set source_id = s.id
from public.patient_sources s
where c.source is not null and c.source_id is null and s.clinic_id = c.clinic_id and s.key = public.legacy_source_key(c.source::text);

-- Funções que usavam o enum.
drop function public.patient_list(text, text, public.patient_source, integer, integer);
drop function public.patient_segment_counts(text, public.patient_source);
drop function public.search_patients(text, text, public.patient_source, integer, integer);

-- Busca rápida (agenda, orçamento, CRM): sem origem.
create function public.search_patients(
  _query text default '',
  _status text default 'active',
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
  archived_at timestamptz,
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
      regexp_replace(coalesce(_query, ''), '\D', '', 'g') as digits
  )
  select
    p.id, p.full_name, p.cpf, p.birth_date, p.phone, p.whatsapp, p.archived_at,
    count(*) over () as total_count
  from public.patients p, params
  where
    (
      (_status = 'active' and p.archived_at is null)
      or (_status = 'archived' and p.archived_at is not null)
      or _status = 'all'
    )
    and (
      params.q = ''
      or p.search_name like '%' || params.q || '%'
      or (length(params.digits) >= 3 and (
        p.cpf like params.digits || '%'
        or p.phone like '%' || params.digits || '%'
        or p.whatsapp like '%' || params.digits || '%'
      ))
    )
  order by p.search_name, p.id
  limit least(greatest(_limit, 1), 100)
  offset greatest(_offset, 0);
$$;

revoke execute on function public.search_patients(text, text, integer, integer) from public, anon;
grant execute on function public.search_patients(text, text, integer, integer) to authenticated;

alter table public.patients drop column source;
alter table public.leads drop column source;
alter table public.crm_campaigns drop column source;

drop type public.patient_source;
drop type public.lead_source;
drop function public.legacy_source_key(text);
