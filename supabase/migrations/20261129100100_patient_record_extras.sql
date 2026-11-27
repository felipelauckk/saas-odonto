-- Fase 3, P5: ficha do paciente.
-- 1) Notas gerais (patient_notes): registro simples, não é prontuário. Todo
--    membro lê e escreve; não se edita o texto, só fixa/desafixa ou apaga
--    (autor ou gestão).
-- 2) Arquivos: pastas (patient_file_folders), exame com tipo e data, e o
--    "kind" já existente vira a categoria (photo = foto, xray = exame,
--    document = documento, other = outro). Mover de pasta e corrigir o tipo
--    do exame passam a ser permitidos para quem escreve no prontuário.

-- Notas gerais -----------------------------------------------------------------------

create table public.patient_notes (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  patient_id uuid not null,
  body text not null check (length(trim(body)) between 1 and 2000),
  pinned boolean not null default false,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (patient_id, clinic_id) references public.patients (id, clinic_id) on delete restrict
);

create index patient_notes_patient_idx on public.patient_notes (patient_id, pinned desc, created_at desc);

create trigger patient_notes_set_updated_at
  before update on public.patient_notes
  for each row execute function public.set_updated_at();

alter table public.patient_notes enable row level security;
revoke all on public.patient_notes from anon, authenticated;
grant select, delete on public.patient_notes to authenticated;
grant insert (clinic_id, patient_id, body, pinned) on public.patient_notes to authenticated;
grant update (pinned) on public.patient_notes to authenticated;

create policy "notas do paciente: membro lê" on public.patient_notes for select to authenticated
  using (clinic_id = (select public.current_clinic_id()));
create policy "notas do paciente: membro escreve" on public.patient_notes for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and created_by = (select auth.uid()));
create policy "notas do paciente: autor ou gestão fixa" on public.patient_notes for update to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (created_by = (select auth.uid()) or (select public.has_role('owner', 'manager'))))
  with check (clinic_id = (select public.current_clinic_id()));
create policy "notas do paciente: autor ou gestão apaga" on public.patient_notes for delete to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (created_by = (select auth.uid()) or (select public.has_role('owner', 'manager'))));

create trigger patient_notes_enforce_writable before insert or update or delete on public.patient_notes
  for each row execute function public.enforce_clinic_writable();

-- Pastas de arquivos ------------------------------------------------------------------

create table public.patient_file_folders (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  patient_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, clinic_id),
  unique (patient_id, name),
  foreign key (patient_id, clinic_id) references public.patients (id, clinic_id) on delete restrict
);

create trigger patient_file_folders_set_updated_at
  before update on public.patient_file_folders
  for each row execute function public.set_updated_at();

alter table public.patient_file_folders enable row level security;
revoke all on public.patient_file_folders from anon, authenticated;
grant select, delete on public.patient_file_folders to authenticated;
grant insert (clinic_id, patient_id, name) on public.patient_file_folders to authenticated;
grant update (name) on public.patient_file_folders to authenticated;

create policy "pastas: leitura" on public.patient_file_folders for select to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.can_read_clinical()));
create policy "pastas: cria" on public.patient_file_folders for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and (select public.can_write_clinical()));
create policy "pastas: renomeia" on public.patient_file_folders for update to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.can_write_clinical()))
  with check (clinic_id = (select public.current_clinic_id()));
-- Apagar a pasta não apaga os arquivos: eles voltam para "Sem pasta".
create policy "pastas: apaga" on public.patient_file_folders for delete to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.can_write_clinical()));

create trigger patient_file_folders_enforce_writable before insert or update or delete on public.patient_file_folders
  for each row execute function public.enforce_clinic_writable();

-- Arquivos: pasta, exame e categoria -------------------------------------------------

alter table public.patient_files
  add column folder_id uuid,
  add column exam_type text check (exam_type in ('panoramica', 'periapical', 'tomografia', 'interproximal', 'outro')),
  add column taken_on date,
  add constraint patient_files_folder_fk foreign key (folder_id, clinic_id)
    references public.patient_file_folders (id, clinic_id) on delete set null (folder_id);

create index patient_files_folder_idx on public.patient_files (folder_id) where folder_id is not null;

grant insert (folder_id, exam_type, taken_on) on public.patient_files to authenticated;
grant update (folder_id, exam_type, taken_on, description) on public.patient_files to authenticated;

create policy "prontuário: organizar arquivos" on public.patient_files for update to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.can_write_clinical()))
  with check (clinic_id = (select public.current_clinic_id()));

-- A pasta tem de ser do mesmo paciente do arquivo.
create function public.check_patient_file_folder()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.folder_id is not null and not exists (
    select 1 from public.patient_file_folders f where f.id = new.folder_id and f.patient_id = new.patient_id
  ) then
    raise exception 'A pasta é de outro paciente.' using errcode = 'OC020';
  end if;
  return new;
end;
$$;

create trigger patient_files_check_folder
  before insert or update of folder_id on public.patient_files
  for each row execute function public.check_patient_file_folder();
