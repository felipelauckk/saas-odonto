-- A trava "clínica sempre com um owner ativo" vale só para UPDATE.
-- No DELETE ela impedia apagar uma conta em auth.users (o cascade remove o
-- vínculo). O app não tem permissão de DELETE em clinic_members.
drop trigger clinic_members_ensure_owner on public.clinic_members;

create trigger clinic_members_ensure_owner
  after update on public.clinic_members
  for each row execute function public.ensure_clinic_has_owner();
