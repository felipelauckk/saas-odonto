-- Etapa 6: prontuário clínico (anamnese, odontograma, evoluções e arquivos).
--
-- Permissões (especificação, "Segurança, permissões e LGPD"):
--  * Dentista: total. Owner/manager: leitura. Recepção: só os alertas da anamnese.
--  * Quem está ligado a um profissional (ex.: dono que também atende) também
--    escreve, mesmo sendo owner/manager.
--  * Nada clínico é apagado nem editado: anamnese vira nova versão, odontograma
--    ganha novo registro, evolução só recebe complemento, arquivo fica guardado
--    (CFO: prontuário guardado por no mínimo 20 anos).

create type public.tooth_condition as enum (
  'healthy', 'caries', 'restored', 'missing', 'implant', 'crown', 'root_canal', 'other'
);
create type public.patient_file_kind as enum ('photo', 'xray', 'document', 'other');

-- Quem lê e quem escreve no prontuário ---------------------------------------------

create function public.can_read_clinical()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('owner', 'manager', 'dentist');
$$;

create function public.can_write_clinical()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('dentist')
    or (public.has_role('owner', 'manager') and exists (select 1 from public.current_professional_ids()));
$$;

revoke execute on function public.can_read_clinical() from public, anon;
revoke execute on function public.can_write_clinical() from public, anon;
grant execute on function public.can_read_clinical() to authenticated;
grant execute on function public.can_write_clinical() to authenticated;

-- Anamneses (cada salvamento é uma versão) ------------------------------------------

create table public.anamneses (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  patient_id uuid not null,
  template_id uuid references public.anamnesis_templates (id) on delete set null,
  -- Cópia das perguntas com as respostas (o modelo pode mudar depois):
  -- [{ id, label, type, alert, details, answer: "yes"|"no"|null, text }]
  answers jsonb not null check (jsonb_typeof(answers) = 'array'),
  filled_by uuid references auth.users (id) on delete set null,
  signed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (patient_id, clinic_id) references public.patients (id, clinic_id) on delete restrict
);

create index anamneses_patient_idx on public.anamneses (patient_id, created_at desc);

create trigger anamneses_set_updated_at
  before update on public.anamneses
  for each row execute function public.set_updated_at();

-- Odontograma (registros; o estado atual é o mais recente de cada dente/face) --------

create table public.tooth_records (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  patient_id uuid not null,
  -- Numeração FDI: 11–48 permanentes, 51–85 decíduos.
  tooth smallint not null check (
    (tooth / 10 between 1 and 4 and tooth % 10 between 1 and 8)
    or (tooth / 10 between 5 and 8 and tooth % 10 between 1 and 5)
  ),
  -- Faces: M (mesial), D (distal), O (oclusal/incisal), V (vestibular), L (lingual/palatina).
  -- Vazio = dente inteiro.
  faces text[] not null default '{}' check (faces <@ array['M', 'D', 'O', 'V', 'L']),
  condition public.tooth_condition not null,
  notes text check (length(notes) <= 1000),
  recorded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (patient_id, clinic_id) references public.patients (id, clinic_id) on delete restrict
);

create index tooth_records_patient_idx on public.tooth_records (patient_id, created_at);

create trigger tooth_records_set_updated_at
  before update on public.tooth_records
  for each row execute function public.set_updated_at();

-- Evoluções clínicas (nunca editadas; complementos apontam para a original) ----------

create table public.clinical_notes (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  patient_id uuid not null,
  professional_id uuid not null,
  appointment_id uuid references public.appointments (id) on delete set null,
  complements_note_id uuid references public.clinical_notes (id) on delete restrict,
  body text not null check (length(trim(body)) > 0 and length(body) <= 10000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (patient_id, clinic_id) references public.patients (id, clinic_id) on delete restrict,
  foreign key (professional_id, clinic_id) references public.professionals (id, clinic_id) on delete restrict
);

create index clinical_notes_patient_idx on public.clinical_notes (patient_id, created_at desc);

create trigger clinical_notes_set_updated_at
  before update on public.clinical_notes
  for each row execute function public.set_updated_at();

-- Arquivos do paciente (fotos, radiografias, documentos) ------------------------------

create table public.patient_files (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  patient_id uuid not null,
  -- Caminho no bucket "clinic": {clinic_id}/patients/{patient_id}/{arquivo}
  storage_path text not null unique,
  kind public.patient_file_kind not null default 'other',
  description text check (length(description) <= 300),
  mime_type text,
  size_bytes integer,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (storage_path like clinic_id::text || '/patients/' || patient_id::text || '/%'),
  foreign key (patient_id, clinic_id) references public.patients (id, clinic_id) on delete restrict
);

create index patient_files_patient_idx on public.patient_files (patient_id, created_at desc);

create trigger patient_files_set_updated_at
  before update on public.patient_files
  for each row execute function public.set_updated_at();

-- Permissões: só SELECT e INSERT (sem UPDATE/DELETE no que é clínico) -----------------

alter table public.anamneses enable row level security;
alter table public.tooth_records enable row level security;
alter table public.clinical_notes enable row level security;
alter table public.patient_files enable row level security;

revoke all on public.anamneses, public.tooth_records, public.clinical_notes, public.patient_files from anon, authenticated;

grant select on public.anamneses, public.tooth_records, public.clinical_notes, public.patient_files to authenticated;
grant insert (clinic_id, patient_id, template_id, answers, filled_by, signed_at) on public.anamneses to authenticated;
grant insert (clinic_id, patient_id, tooth, faces, condition, notes, recorded_by) on public.tooth_records to authenticated;
grant insert (clinic_id, patient_id, professional_id, appointment_id, complements_note_id, body, created_by)
  on public.clinical_notes to authenticated;
grant insert (clinic_id, patient_id, storage_path, kind, description, mime_type, size_bytes, uploaded_by)
  on public.patient_files to authenticated;

create policy "prontuário: leitura" on public.anamneses for select to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.can_read_clinical()));
create policy "prontuário: escrita" on public.anamneses for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and (select public.can_write_clinical()));

create policy "prontuário: leitura" on public.tooth_records for select to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.can_read_clinical()));
create policy "prontuário: escrita" on public.tooth_records for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and (select public.can_write_clinical()));

create policy "prontuário: leitura" on public.clinical_notes for select to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.can_read_clinical()));
-- A evolução é assinada por um profissional ligado a quem escreve.
create policy "prontuário: escrita" on public.clinical_notes for insert to authenticated
  with check (
    clinic_id = (select public.current_clinic_id())
    and (select public.can_write_clinical())
    and professional_id in (select public.current_professional_ids())
  );

create policy "prontuário: leitura" on public.patient_files for select to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.can_read_clinical()));
create policy "prontuário: escrita" on public.patient_files for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and (select public.can_write_clinical()));

-- Alertas da anamnese (todos os papéis, inclusive recepção) ---------------------------
-- Devolve só as perguntas de alerta respondidas "sim" na versão mais recente.

create function public.patient_alerts(_patient_id uuid)
returns table (label text, details text)
language sql
stable
security definer
set search_path = ''
as $$
  with latest as (
    select a.answers
    from public.anamneses a
    join public.patients p on p.id = a.patient_id
    where a.patient_id = _patient_id
      and a.clinic_id = public.current_clinic_id()
      and p.clinic_id = public.current_clinic_id()
    order by a.created_at desc
    limit 1
  )
  select q ->> 'label', nullif(trim(q ->> 'text'), '')
  from latest, jsonb_array_elements(latest.answers) q
  where (q ->> 'alert')::boolean is true
    and q ->> 'answer' = 'yes';
$$;

revoke execute on function public.patient_alerts(uuid) from public, anon;
grant execute on function public.patient_alerts(uuid) to authenticated;

-- Arquivos clínicos no Storage: {clinic_id}/patients/{patient_id}/... ------------------

create policy "prontuário: ler arquivos clínicos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'clinic'
    and (storage.foldername(name))[1] = (select public.current_clinic_id())::text
    and (storage.foldername(name))[2] = 'patients'
    and (select public.can_read_clinical())
  );

create policy "prontuário: enviar arquivos clínicos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'clinic'
    and (storage.foldername(name))[1] = (select public.current_clinic_id())::text
    and (storage.foldername(name))[2] = 'patients'
    and (select public.can_write_clinical())
  );
-- Sem políticas de UPDATE/DELETE: arquivo clínico enviado não é trocado nem apagado pelo app.
