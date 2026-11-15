-- Etapa 22: metas mensais por clínica, unidade e profissional.
--
--  * Uma meta por mês, indicador e escopo (clínica toda, uma unidade ou um
--    profissional). Dinheiro em centavos; conversão em fração (0,35 = 35%).
--  * Só a gestão define e vê as metas (o painel analítico é da gestão).

create type public.goal_metric as enum ('revenue', 'production', 'approved_quotes', 'new_patients', 'conversion');

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  month date not null check (extract(day from month) = 1),
  metric public.goal_metric not null,
  unit_id uuid,
  professional_id uuid,
  target numeric(14, 4) not null check (target >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (unit_id is null or professional_id is null),
  check (metric <> 'conversion' or target <= 1),
  foreign key (unit_id, clinic_id) references public.units (id, clinic_id) on delete cascade,
  foreign key (professional_id, clinic_id) references public.professionals (id, clinic_id) on delete cascade
);
create unique index goals_scope_key on public.goals (clinic_id, month, metric, unit_id, professional_id) nulls not distinct;

create trigger goals_set_updated_at before update on public.goals for each row execute function public.set_updated_at();
create trigger goals_enforce_writable before insert or update or delete on public.goals for each row execute function public.enforce_clinic_writable();

alter table public.goals enable row level security;
revoke all on public.goals from anon, authenticated;
grant select, delete on public.goals to authenticated;
grant insert (clinic_id, month, metric, unit_id, professional_id, target) on public.goals to authenticated;
grant update (target) on public.goals to authenticated;
create policy "metas: gestão lê" on public.goals for select to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')));
create policy "metas: gestão cria" on public.goals for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')));
create policy "metas: gestão edita" on public.goals for update to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')))
  with check (clinic_id = (select public.current_clinic_id()));
create policy "metas: gestão apaga" on public.goals for delete to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')));
