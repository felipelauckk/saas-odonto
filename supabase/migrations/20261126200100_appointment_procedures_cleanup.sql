-- Fase 3, P1 (pendências):
--  * Item do orçamento escrito à mão (sem procedimento cadastrado) também pode
--    ir para a consulta: procedure_id vira opcional e o nome fica em
--    description. Um dos dois é obrigatório.
--  * appointments.procedure_id sai: a lista da consulta está toda em
--    appointment_procedures (copiada na migration 20261126100100) e nada mais
--    lê nem grava a coluna.

alter table public.appointment_procedures
  alter column procedure_id drop not null,
  add column description text check (description is null or (length(trim(description)) > 0 and length(description) <= 200)),
  add constraint appointment_procedures_procedure_or_description check (procedure_id is not null or description is not null);

grant insert (description) on public.appointment_procedures to authenticated;

-- Garantia: qualquer procedure_id que ainda não tenha linha na lista é copiado antes de apagar.
insert into public.appointment_procedures (clinic_id, appointment_id, procedure_id, position)
select a.clinic_id, a.id, a.procedure_id, 0
from public.appointments a
join public.procedures p on p.id = a.procedure_id and p.clinic_id = a.clinic_id
where a.procedure_id is not null
  and not exists (select 1 from public.appointment_procedures ap where ap.appointment_id = a.id);

alter table public.appointments drop column procedure_id;
