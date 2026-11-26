-- Fase 3, P2: compromissos (bloqueios com nome, observação, dia inteiro,
-- repetição e eventos que não bloqueiam).
--
-- Regras:
--  * kind = 'block' impede marcar consulta no horário (como sempre);
--    kind = 'event' é só um lembrete na agenda e não impede nada.
--  * all_day: vai das 00:00 às 00:00 do dia seguinte (como já era gravado) e
--    aparece como faixa no topo da coluna.
--  * series_id junta as ocorrências de um compromisso que se repete.
--  * title substitui reason (copiado aqui; reason sai numa próxima migration,
--    depois que o código novo estiver no ar).
--  * Editar segue a mesma regra de criar e apagar: unidades permitidas e, para
--    o dentista, só a própria agenda (nunca a clínica toda).

alter table public.schedule_blocks
  add column title text not null default 'Bloqueio' check (length(trim(title)) > 0 and length(title) <= 120),
  add column notes text check (length(notes) <= 1000),
  add column all_day boolean not null default false,
  add column series_id uuid,
  add column kind text not null default 'block' check (kind in ('block', 'event'));

update public.schedule_blocks
   set title = left(coalesce(nullif(trim(reason), ''), 'Bloqueio'), 120),
       all_day = (
         (starts_at at time zone 'America/Sao_Paulo')::time = '00:00'
         and (ends_at at time zone 'America/Sao_Paulo')::time = '00:00'
       );

create index schedule_blocks_series_idx on public.schedule_blocks (series_id, starts_at) where series_id is not null;

grant insert (title, notes, all_day, series_id, kind) on public.schedule_blocks to authenticated;
grant update (professional_id, starts_at, ends_at, title, notes, all_day, kind) on public.schedule_blocks to authenticated;

create policy "agenda: alterar bloqueios"
  on public.schedule_blocks for update to authenticated
  using (
    clinic_id = (select public.current_clinic_id())
    and public.can_access_unit(unit_id)
    and (
      not (select public.has_role('dentist'))
      or professional_id in (select public.current_professional_ids())
    )
  )
  with check (
    clinic_id = (select public.current_clinic_id())
    and public.can_access_unit(unit_id)
    and (
      not (select public.has_role('dentist'))
      or professional_id in (select public.current_professional_ids())
    )
  );

-- Consulta em horário bloqueado é recusada (SQLSTATE OB001); evento não bloqueia.
create or replace function public.check_appointment_not_blocked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _title text;
begin
  if new.status in ('canceled', 'no_show') then
    return new;
  end if;

  select b.title into _title
  from public.schedule_blocks b
  where b.unit_id = new.unit_id
    and b.kind = 'block'
    and (b.professional_id is null or b.professional_id = new.professional_id)
    and tstzrange(b.starts_at, b.ends_at) && tstzrange(new.starts_at, new.ends_at)
  limit 1;

  if found then
    raise exception 'Horário bloqueado: %', _title using errcode = 'OB001';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_appointment_not_blocked() from public, anon, authenticated;
