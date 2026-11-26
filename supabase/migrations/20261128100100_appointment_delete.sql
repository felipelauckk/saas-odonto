-- Fase 3, P3: excluir consulta (só gestão).
--
-- Até aqui consulta nunca era apagada, só desmarcada. Agora owner e manager
-- podem apagar uma consulta lançada por engano, desde que ela não tenha
-- registro clínico ligado (evolução). Com histórico, continua só "Desmarcar".
-- A checagem do histórico é feita numa função própria porque a gestão pode
-- não enxergar o prontuário pela RLS.

create function public.appointment_has_clinical_record(_appointment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.clinical_notes n where n.appointment_id = _appointment_id);
$$;

revoke execute on function public.appointment_has_clinical_record(uuid) from public, anon;
grant execute on function public.appointment_has_clinical_record(uuid) to authenticated;

grant delete on public.appointments to authenticated;

create policy "agenda: gestão exclui consulta sem histórico clínico"
  on public.appointments for delete to authenticated
  using (
    clinic_id = (select public.current_clinic_id())
    and (select public.has_role('owner', 'manager'))
    and public.can_access_agenda(unit_id, professional_id)
    and not public.appointment_has_clinical_record(id)
  );
