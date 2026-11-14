-- Etapa 2: permissões e políticas de RLS das tabelas de acesso.
--
-- Regras gerais:
--  * anon (sem login) não lê nada, exceto planos ativos.
--  * Cada usuário só enxerga as clínicas das quais é membro ativo e só os dados
--    da clínica ativa (current_clinic_id()).
--  * Só owner/manager alteram clínica, unidades e membros. Só owner cria ou
--    altera outro owner.
--  * Colunas sensíveis (assinatura, clínica ativa, vínculos) não são graváveis
--    pelo app: os privilégios por coluna abaixo limitam o que o UPDATE alcança.

-- Unidade permitida para o usuário na clínica ativa?
-- owner/manager: todas. Demais: as de unit_ids (vazio = todas).
create function public.can_access_unit(_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.clinic_members m
    join public.units u
      on u.id = _unit_id
     and u.clinic_id = m.clinic_id
    where m.user_id = (select auth.uid())
      and m.clinic_id = public.current_clinic_id()
      and m.active
      and (
        m.role in ('owner', 'manager')
        or cardinality(m.unit_ids) = 0
        or _unit_id = any (m.unit_ids)
      )
  );
$$;

revoke execute on function public.can_access_unit(uuid) from public, anon;
grant execute on function public.can_access_unit(uuid) to authenticated;

-- Privilégios -----------------------------------------------------------------------

revoke all on public.plans, public.clinics, public.units, public.profiles, public.clinic_members
  from anon, authenticated;

grant select on public.plans to anon, authenticated;

grant select on public.clinics to authenticated;
grant update (name, legal_name, document_cnpj_cpf, phone, email, logo_url)
  on public.clinics to authenticated;

grant select, insert on public.units to authenticated;
grant update (name, address, phone, timezone, active) on public.units to authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, phone, avatar_url) on public.profiles to authenticated;

grant select on public.clinic_members to authenticated;
grant insert (clinic_id, user_id, role, unit_ids) on public.clinic_members to authenticated;
grant update (role, unit_ids, active) on public.clinic_members to authenticated;

-- plans -------------------------------------------------------------------------------

create policy "planos ativos são públicos"
  on public.plans for select
  to anon, authenticated
  using (active);

-- clinics -----------------------------------------------------------------------------

create policy "membro vê as próprias clínicas"
  on public.clinics for select
  to authenticated
  using (id in (select public.user_clinic_ids()));

create policy "owner e manager editam a clínica ativa"
  on public.clinics for update
  to authenticated
  using (id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')))
  with check (id = (select public.current_clinic_id()));

-- units -------------------------------------------------------------------------------

create policy "membro vê as unidades permitidas da clínica ativa"
  on public.units for select
  to authenticated
  using (clinic_id = (select public.current_clinic_id()) and public.can_access_unit(id));

create policy "owner e manager criam unidades"
  on public.units for insert
  to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')));

create policy "owner e manager editam unidades"
  on public.units for update
  to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')))
  with check (clinic_id = (select public.current_clinic_id()));

-- profiles ----------------------------------------------------------------------------

create policy "usuário vê o próprio perfil e os colegas da clínica ativa"
  on public.profiles for select
  to authenticated
  using (
    id = (select auth.uid())
    or id in (
      select m.user_id
      from public.clinic_members m
      where m.clinic_id = (select public.current_clinic_id())
    )
  );

create policy "usuário edita o próprio perfil"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- clinic_members ------------------------------------------------------------------------

create policy "membro vê os próprios vínculos e a equipe da clínica ativa"
  on public.clinic_members for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or clinic_id = (select public.current_clinic_id())
  );

create policy "owner e manager adicionam membros"
  on public.clinic_members for insert
  to authenticated
  with check (
    clinic_id = (select public.current_clinic_id())
    and (select public.has_role('owner', 'manager'))
    and (role <> 'owner' or (select public.has_role('owner')))
  );

create policy "owner e manager editam membros"
  on public.clinic_members for update
  to authenticated
  using (
    clinic_id = (select public.current_clinic_id())
    and (select public.has_role('owner', 'manager'))
    and (role <> 'owner' or (select public.has_role('owner')))
  )
  with check (
    clinic_id = (select public.current_clinic_id())
    and (role <> 'owner' or (select public.has_role('owner')))
  );

-- A clínica nunca pode ficar sem um owner ativo.
create function public.ensure_clinic_has_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'owner' and old.active and not exists (
    select 1
    from public.clinic_members m
    where m.clinic_id = old.clinic_id
      and m.role = 'owner'
      and m.active
  ) then
    raise exception 'A clínica precisa ter pelo menos um proprietário ativo.' using errcode = '23514';
  end if;
  return null;
end;
$$;

revoke execute on function public.ensure_clinic_has_owner() from public, anon, authenticated;

create trigger clinic_members_ensure_owner
  after update or delete on public.clinic_members
  for each row execute function public.ensure_clinic_has_owner();
