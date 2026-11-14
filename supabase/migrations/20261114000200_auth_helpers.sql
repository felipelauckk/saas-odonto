-- Etapa 2: funções usadas pelas políticas de RLS.
-- São SECURITY DEFINER para ler clinic_members/profiles sem cair na própria RLS
-- (evita recursão). Todas fixam search_path vazio e qualificam os nomes.

-- Clínica ativa do usuário logado.
-- Usa profiles.active_clinic_id se o usuário for membro ativo dela; senão,
-- a primeira clínica em que ele é membro ativo. Sem vínculo, devolve null.
create function public.current_clinic_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select p.active_clinic_id
      from public.profiles p
      join public.clinic_members m
        on m.clinic_id = p.active_clinic_id
       and m.user_id = p.id
       and m.active
      where p.id = (select auth.uid())
    ),
    (
      select m.clinic_id
      from public.clinic_members m
      where m.user_id = (select auth.uid())
        and m.active
      order by m.created_at, m.clinic_id
      limit 1
    )
  );
$$;

-- O usuário tem algum dos papéis informados na clínica ativa?
-- Uso: has_role('owner') ou has_role('owner', 'manager').
create function public.has_role(variadic _roles public.member_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.clinic_members m
    where m.user_id = (select auth.uid())
      and m.clinic_id = public.current_clinic_id()
      and m.active
      and m.role = any (_roles)
  );
$$;

-- Clínicas em que o usuário é membro ativo (para o seletor de clínica).
create function public.user_clinic_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.clinic_id
  from public.clinic_members m
  where m.user_id = (select auth.uid())
    and m.active;
$$;

-- Troca a clínica ativa. Falha se o usuário não for membro ativo dela.
create function public.set_active_clinic(_clinic_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.clinic_members m
    where m.user_id = (select auth.uid())
      and m.clinic_id = _clinic_id
      and m.active
  ) then
    raise exception 'Você não tem acesso a esta clínica.' using errcode = '42501';
  end if;

  update public.profiles
     set active_clinic_id = _clinic_id
   where id = (select auth.uid());
end;
$$;

-- Ninguém sem login usa estas funções.
revoke execute on function public.current_clinic_id() from public, anon;
revoke execute on function public.has_role(public.member_role[]) from public, anon;
revoke execute on function public.user_clinic_ids() from public, anon;
revoke execute on function public.set_active_clinic(uuid) from public, anon;
grant execute on function public.current_clinic_id() to authenticated;
grant execute on function public.has_role(public.member_role[]) to authenticated;
grant execute on function public.user_clinic_ids() to authenticated;
grant execute on function public.set_active_clinic(uuid) to authenticated;
