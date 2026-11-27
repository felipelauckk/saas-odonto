-- P5: nome de quem escreveu a nota, gravado na nota (os membros não leem o
-- perfil uns dos outros).
alter table public.patient_notes add column author_name text;

create function public.patient_notes_set_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.author_name := coalesce((select nullif(trim(p.full_name), '') from public.profiles p where p.id = auth.uid()), 'Alguém da equipe');
  return new;
end;
$$;
revoke execute on function public.patient_notes_set_author() from public, anon, authenticated;

create trigger patient_notes_set_author
  before insert on public.patient_notes
  for each row execute function public.patient_notes_set_author();
