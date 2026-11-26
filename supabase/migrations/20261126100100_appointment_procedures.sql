-- Fase 3, P1: vários procedimentos por consulta e mensagens por consulta.
--
-- Regras:
--  * Cada consulta tem zero ou mais procedimentos (com dente e faces opcionais),
--    em ordem. Quem vê e mexe na consulta vê e mexe nos procedimentos dela.
--  * Procedimento vindo do plano de tratamento guarda o item de origem
--    (treatment_item_id), para não oferecer o mesmo item de novo.
--  * appointments.procedure_id fica só por compatibilidade: é copiado para a
--    tabela nova e o sistema deixa de gravar nele (remover numa próxima etapa).
--  * confirmation_mode: 'auto' (lembrete da véspera com botão Confirmar),
--    'none' (lembrete sem o botão), 'now' (pede a confirmação ao salvar).
--  * reminder_mode: 'none' tira a consulta da rotina de lembrete.

alter table public.treatment_items add constraint treatment_items_id_clinic_key unique (id, clinic_id);

create table public.appointment_procedures (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  appointment_id uuid not null,
  procedure_id uuid not null,
  treatment_item_id uuid,
  -- Mesmo formato do item do orçamento (numeração FDI, decíduos 51–85).
  tooth smallint check (
    tooth is null
    or (tooth / 10 between 1 and 4 and tooth % 10 between 1 and 8)
    or (tooth / 10 between 5 and 8 and tooth % 10 between 1 and 5)
  ),
  faces text[] check (faces is null or faces <@ array['M', 'D', 'O', 'V', 'L']),
  position smallint not null default 0 check (position between 0 and 49),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (appointment_id, clinic_id) references public.appointments (id, clinic_id) on delete cascade,
  foreign key (procedure_id, clinic_id) references public.procedures (id, clinic_id) on delete restrict,
  foreign key (treatment_item_id, clinic_id) references public.treatment_items (id, clinic_id) on delete set null (treatment_item_id)
);

create index appointment_procedures_appointment_idx on public.appointment_procedures (appointment_id, position);
create index appointment_procedures_clinic_idx on public.appointment_procedures (clinic_id);
create index appointment_procedures_item_idx on public.appointment_procedures (treatment_item_id) where treatment_item_id is not null;

create trigger appointment_procedures_set_updated_at
  before update on public.appointment_procedures
  for each row execute function public.set_updated_at();

alter table public.appointment_procedures enable row level security;
revoke all on public.appointment_procedures from anon, authenticated;

grant select, delete on public.appointment_procedures to authenticated;
grant insert (clinic_id, appointment_id, procedure_id, treatment_item_id, tooth, faces, position) on public.appointment_procedures to authenticated;

-- Segue a permissão da consulta (a política de appointments filtra o exists).
create policy "procedimentos da consulta: lê" on public.appointment_procedures for select to authenticated
  using (clinic_id = (select public.current_clinic_id()) and exists (select 1 from public.appointments a where a.id = appointment_id));
create policy "procedimentos da consulta: inclui" on public.appointment_procedures for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and exists (select 1 from public.appointments a where a.id = appointment_id));
create policy "procedimentos da consulta: remove" on public.appointment_procedures for delete to authenticated
  using (clinic_id = (select public.current_clinic_id()) and exists (select 1 from public.appointments a where a.id = appointment_id));

-- Consultas que já tinham procedimento ganham a linha nova.
insert into public.appointment_procedures (clinic_id, appointment_id, procedure_id, position)
select a.clinic_id, a.id, a.procedure_id, 0
from public.appointments a
join public.procedures p on p.id = a.procedure_id and p.clinic_id = a.clinic_id
where a.procedure_id is not null;

-- Mensagens por consulta ---------------------------------------------------------------

alter table public.appointments
  add column confirmation_mode text not null default 'auto' check (confirmation_mode in ('auto', 'none', 'now')),
  add column reminder_mode text not null default 'auto' check (reminder_mode in ('auto', 'none'));

grant insert (confirmation_mode, reminder_mode) on public.appointments to authenticated;
grant update (confirmation_mode, reminder_mode) on public.appointments to authenticated;
