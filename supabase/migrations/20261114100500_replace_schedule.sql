-- Etapa 3: grava a grade semanal de um profissional numa transação só.
-- SECURITY INVOKER: roda com as permissões de quem chama, então a RLS
-- (só owner/manager da clínica ativa) e a trava de sobreposição valem.
-- _entries: [{ "unit_id": uuid, "weekday": 0-6, "start_time": "08:00", "end_time": "12:00" }]

create function public.replace_professional_schedule(_professional_id uuid, _entries jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  _clinic_id uuid := public.current_clinic_id();
begin
  if not exists (
    select 1 from public.professionals p
    where p.id = _professional_id and p.clinic_id = _clinic_id
  ) then
    raise exception 'Profissional não encontrado.' using errcode = 'P0002';
  end if;

  delete from public.professional_schedules
   where professional_id = _professional_id;

  insert into public.professional_schedules (clinic_id, unit_id, professional_id, weekday, start_time, end_time)
  select _clinic_id, e.unit_id, _professional_id, e.weekday, e.start_time, e.end_time
  from jsonb_to_recordset(coalesce(_entries, '[]'::jsonb))
    as e (unit_id uuid, weekday smallint, start_time time, end_time time);
end;
$$;

revoke execute on function public.replace_professional_schedule(uuid, jsonb) from public, anon;
grant execute on function public.replace_professional_schedule(uuid, jsonb) to authenticated;
