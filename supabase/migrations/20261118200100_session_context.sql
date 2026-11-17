-- Contexto da sessão numa chamada só: perfil, clínicas do usuário com o papel,
-- clínica ativa, unidades permitidas, situação da assinatura e CRO.
-- Substitui duas rodadas de consultas feitas a cada clique (layout do app).
-- security invoker: cada parte passa pela mesma RLS das consultas que substitui.

create function public.session_context()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (
    select (select auth.uid()) as uid, (select public.current_clinic_id()) as cid
  ),
  mem as (
    select m.id, m.clinic_id, m.role
    from public.clinic_members m, me
    where m.user_id = me.uid and m.active
  )
  select jsonb_build_object(
    'full_name', (select p.full_name from public.profiles p, me where p.id = me.uid),
    'clinics', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'role', mem.role,
          'subscription_status', c.subscription_status,
          'trial_ends_at', c.trial_ends_at
        ) order by c.name
      )
      from public.clinics c
      join mem on mem.clinic_id = c.id
    ), '[]'::jsonb),
    'current_clinic_id', (select me.cid from me),
    'units', coalesce((
      select jsonb_agg(jsonb_build_object('id', u.id, 'name', u.name) order by u.created_at)
      from public.units u, me
      where u.active and u.clinic_id = me.cid
    ), '[]'::jsonb),
    'access_state', (select public.clinic_access_state(me.cid) from me where me.cid is not null),
    'cro', (
      select pr.cro
      from public.professionals pr
      join mem on mem.id = pr.member_id
      join me on mem.clinic_id = me.cid
      limit 1
    )
  );
$$;

revoke execute on function public.session_context() from public, anon;
grant execute on function public.session_context() to authenticated;
