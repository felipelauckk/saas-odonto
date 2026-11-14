-- Etapa 2: cadastro público e criação de perfil.
--
-- Todo usuário novo em auth.users ganha um profile. Quando o cadastro vem da
-- tela pública, os metadados trazem `clinic_name`: nesse caso, na mesma
-- transação, nascem a clínica (em teste de 14 dias), a primeira unidade e o
-- vínculo do usuário como owner. Usuários convidados não trazem `clinic_name`
-- e recebem o vínculo pelo convite.

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  _full_name text := nullif(trim(_meta ->> 'full_name'), '');
  _phone text := nullif(trim(_meta ->> 'phone'), '');
  _clinic_name text := nullif(trim(_meta ->> 'clinic_name'), '');
  _clinic_id uuid;
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, _full_name, _phone);

  if _clinic_name is not null then
    insert into public.clinics (name, phone, email, subscription_status, trial_ends_at)
    values (left(_clinic_name, 200), _phone, new.email, 'trialing', now() + interval '14 days')
    returning id into _clinic_id;

    insert into public.units (clinic_id, name, phone)
    values (_clinic_id, 'Unidade principal', _phone);

    insert into public.clinic_members (clinic_id, user_id, role)
    values (_clinic_id, new.id, 'owner');

    update public.profiles
       set active_clinic_id = _clinic_id
     where id = new.id;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Busca o id de um usuário pelo e-mail. Usada só no servidor (service_role),
-- no convite de alguém que já tem conta.
create function public.find_user_id_by_email(_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
  from auth.users u
  where lower(u.email) = lower(trim(_email))
  limit 1;
$$;

revoke execute on function public.find_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.find_user_id_by_email(text) to service_role;
