-- Etapa 23: abrir uma ficha de especialidade também fica na auditoria.
create or replace function public.log_access(_action text, _table_name text, _record_id uuid, _patient_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _clinic uuid := public.current_clinic_id();
begin
  if _clinic is null or _action not in ('view', 'export') then
    return;
  end if;
  if _table_name not in ('patients', 'anamneses', 'tooth_records', 'clinical_notes', 'patient_files', 'treatment_plans', 'receivables', 'specialty_records') then
    return;
  end if;
  -- O paciente precisa ser da clínica ativa (evita registrar acesso falso em outra clínica).
  if _patient_id is not null and not exists (select 1 from public.patients where id = _patient_id and clinic_id = _clinic) then
    return;
  end if;
  insert into public.audit_log (clinic_id, user_id, action, table_name, record_id, patient_id)
  values (_clinic, (select auth.uid()), _action, _table_name, _record_id, _patient_id);
end;
$$;
