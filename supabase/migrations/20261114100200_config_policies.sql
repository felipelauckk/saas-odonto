-- Etapa 3: permissões das tabelas de configuração.
-- Leitura: qualquer membro ativo da clínica ativa (agenda e orçamentos usam
-- estas listas). Escrita: só owner e manager. Sem DELETE, exceto horários.

revoke all on
  public.professionals,
  public.chairs,
  public.professional_schedules,
  public.procedures,
  public.payment_methods,
  public.anamnesis_templates
from anon, authenticated;

grant select on
  public.professionals,
  public.chairs,
  public.professional_schedules,
  public.procedures,
  public.payment_methods,
  public.anamnesis_templates
to authenticated;

grant insert (clinic_id, member_id, name, cro, specialty, color, active) on public.professionals to authenticated;
grant update (member_id, name, cro, specialty, color, active) on public.professionals to authenticated;

grant insert (clinic_id, unit_id, name, active) on public.chairs to authenticated;
grant update (name, active) on public.chairs to authenticated;

grant insert (clinic_id, unit_id, professional_id, weekday, start_time, end_time)
  on public.professional_schedules to authenticated;
grant delete on public.professional_schedules to authenticated;

grant insert (clinic_id, name, code, category, price_cents, duration_min, applies_to_tooth, active)
  on public.procedures to authenticated;
grant update (name, code, category, price_cents, duration_min, applies_to_tooth, active)
  on public.procedures to authenticated;

grant insert (clinic_id, name, fee_percent, days_to_receive, active) on public.payment_methods to authenticated;
grant update (name, fee_percent, days_to_receive, active) on public.payment_methods to authenticated;

grant insert (clinic_id, name, questions, is_default, active) on public.anamnesis_templates to authenticated;
grant update (name, questions, is_default, active) on public.anamnesis_templates to authenticated;

-- professionals --------------------------------------------------------------------

create policy "membro lê profissionais da clínica ativa"
  on public.professionals for select to authenticated
  using (clinic_id = (select public.current_clinic_id()));

create policy "owner e manager criam profissionais"
  on public.professionals for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')));

create policy "owner e manager editam profissionais"
  on public.professionals for update to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')))
  with check (clinic_id = (select public.current_clinic_id()));

-- chairs ---------------------------------------------------------------------------

create policy "membro lê cadeiras das unidades permitidas"
  on public.chairs for select to authenticated
  using (clinic_id = (select public.current_clinic_id()) and public.can_access_unit(unit_id));

create policy "owner e manager criam cadeiras"
  on public.chairs for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')));

create policy "owner e manager editam cadeiras"
  on public.chairs for update to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')))
  with check (clinic_id = (select public.current_clinic_id()));

-- professional_schedules -------------------------------------------------------------

create policy "membro lê horários das unidades permitidas"
  on public.professional_schedules for select to authenticated
  using (clinic_id = (select public.current_clinic_id()) and public.can_access_unit(unit_id));

create policy "owner e manager criam horários"
  on public.professional_schedules for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')));

create policy "owner e manager apagam horários"
  on public.professional_schedules for delete to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')));

-- procedures -----------------------------------------------------------------------

create policy "membro lê procedimentos da clínica ativa"
  on public.procedures for select to authenticated
  using (clinic_id = (select public.current_clinic_id()));

create policy "owner e manager criam procedimentos"
  on public.procedures for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')));

create policy "owner e manager editam procedimentos"
  on public.procedures for update to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')))
  with check (clinic_id = (select public.current_clinic_id()));

-- payment_methods ------------------------------------------------------------------

create policy "membro lê formas de pagamento da clínica ativa"
  on public.payment_methods for select to authenticated
  using (clinic_id = (select public.current_clinic_id()));

create policy "owner e manager criam formas de pagamento"
  on public.payment_methods for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')));

create policy "owner e manager editam formas de pagamento"
  on public.payment_methods for update to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')))
  with check (clinic_id = (select public.current_clinic_id()));

-- anamnesis_templates ----------------------------------------------------------------

create policy "membro lê modelos de anamnese da clínica ativa"
  on public.anamnesis_templates for select to authenticated
  using (clinic_id = (select public.current_clinic_id()));

create policy "owner e manager criam modelos de anamnese"
  on public.anamnesis_templates for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')));

create policy "owner e manager editam modelos de anamnese"
  on public.anamnesis_templates for update to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')))
  with check (clinic_id = (select public.current_clinic_id()));
