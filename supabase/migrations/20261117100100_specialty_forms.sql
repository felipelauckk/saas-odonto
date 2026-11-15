-- Etapa 23: fichas clínicas por especialidade.
--
--  * Modelos de ficha (construtor como o da anamnese): campos simples, tabela
--    com colunas (implantes por dente, canais, manutenções, aplicações) e
--    periograma. Cinco modelos prontos por clínica.
--  * Cada profissional escolhe as fichas que usa (abas no prontuário).
--  * Registro versionado como a anamnese: só se cria nova versão (cópia do
--    modelo + respostas); nada se edita nem se apaga.
--
-- Formato dos campos (fields):
--   [{ id, label, type: text|textarea|number|date|select|yes_no|table|perio,
--      options?: [texto], columns?: [{ id, label }], unit?: texto }]

create type public.specialty as enum ('ortho', 'implant', 'endo', 'perio', 'hof', 'other');

create table public.specialty_templates (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  specialty public.specialty not null default 'other',
  name text not null check (length(trim(name)) > 0 and length(name) <= 80),
  fields jsonb not null default '[]'::jsonb check (jsonb_typeof(fields) = 'array'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, clinic_id)
);

create table public.professional_specialty_forms (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  professional_id uuid not null,
  template_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (professional_id, template_id),
  foreign key (professional_id, clinic_id) references public.professionals (id, clinic_id) on delete cascade,
  foreign key (template_id, clinic_id) references public.specialty_templates (id, clinic_id) on delete cascade
);

create table public.specialty_records (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  patient_id uuid not null,
  template_id uuid not null,
  -- Cópia do modelo no momento (o modelo pode mudar depois).
  template_name text not null,
  fields jsonb not null check (jsonb_typeof(fields) = 'array'),
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  professional_id uuid,
  filled_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (patient_id, clinic_id) references public.patients (id, clinic_id) on delete restrict,
  foreign key (template_id, clinic_id) references public.specialty_templates (id, clinic_id) on delete restrict,
  foreign key (professional_id, clinic_id) references public.professionals (id, clinic_id) on delete restrict
);
create index specialty_records_patient_idx on public.specialty_records (patient_id, template_id, created_at desc);

do $$
declare
  _table text;
begin
  foreach _table in array array['specialty_templates', 'professional_specialty_forms', 'specialty_records'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', _table || '_set_updated_at', _table);
    execute format('create trigger %I before insert or update or delete on public.%I for each row execute function public.enforce_clinic_writable()', _table || '_enforce_writable', _table);
  end loop;
end;
$$;

create trigger specialty_records_audit after insert or update or delete on public.specialty_records
  for each row execute function public.audit_changes();

alter table public.specialty_templates enable row level security;
alter table public.professional_specialty_forms enable row level security;
alter table public.specialty_records enable row level security;
revoke all on public.specialty_templates, public.professional_specialty_forms, public.specialty_records from anon, authenticated;

grant select on public.specialty_templates, public.professional_specialty_forms to authenticated;
grant insert (clinic_id, specialty, name, fields, active) on public.specialty_templates to authenticated;
grant update (name, fields, active) on public.specialty_templates to authenticated;
grant insert (clinic_id, professional_id, template_id) on public.professional_specialty_forms to authenticated;
grant delete on public.professional_specialty_forms to authenticated;

create policy "fichas: membro lê modelos" on public.specialty_templates for select to authenticated using (clinic_id = (select public.current_clinic_id()));
create policy "fichas: gestão cria modelos" on public.specialty_templates for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')));
create policy "fichas: gestão edita modelos" on public.specialty_templates for update to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')))
  with check (clinic_id = (select public.current_clinic_id()));

-- Quem escolhe as fichas: a gestão ou o próprio profissional.
create policy "fichas do profissional: membro lê" on public.professional_specialty_forms for select to authenticated
  using (clinic_id = (select public.current_clinic_id()));
create policy "fichas do profissional: gestão ou o próprio escolhe" on public.professional_specialty_forms for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id())
              and ((select public.has_role('owner', 'manager')) or professional_id in (select public.current_professional_ids())));
create policy "fichas do profissional: gestão ou o próprio tira" on public.professional_specialty_forms for delete to authenticated
  using (clinic_id = (select public.current_clinic_id())
         and ((select public.has_role('owner', 'manager')) or professional_id in (select public.current_professional_ids())));

grant select on public.specialty_records to authenticated;
grant insert (clinic_id, patient_id, template_id, template_name, fields, data, professional_id, filled_by) on public.specialty_records to authenticated;
create policy "prontuário: leitura" on public.specialty_records for select to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.can_read_clinical()));
create policy "prontuário: escrita" on public.specialty_records for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and (select public.can_write_clinical()) and filled_by = (select auth.uid()));
-- Sem UPDATE/DELETE: cada alteração é uma nova versão.

-- Modelos prontos ------------------------------------------------------------------------------------

create function public.seed_specialty_defaults(_clinic_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.specialty_templates where clinic_id = _clinic_id) then
    return;
  end if;
  insert into public.specialty_templates (clinic_id, specialty, name, fields) values
  (_clinic_id, 'ortho', 'Ortodontia', '[
    {"id":"diagnosis","label":"Diagnóstico","type":"textarea"},
    {"id":"angle_class","label":"Classe de Angle","type":"select","options":["Classe I","Classe II divisão 1","Classe II divisão 2","Classe III"]},
    {"id":"facial_pattern","label":"Padrão facial","type":"select","options":["Padrão I","Padrão II","Padrão III","Face longa","Face curta"]},
    {"id":"appliance","label":"Aparelho","type":"select","options":["Fixo metálico","Fixo estético","Autoligado","Alinhadores","Removível","Contenção"]},
    {"id":"installed_on","label":"Instalação","type":"date"},
    {"id":"expected_months","label":"Previsão de tratamento","type":"number","unit":"meses"},
    {"id":"maintenances","label":"Manutenções","type":"table","columns":[{"id":"date","label":"Data"},{"id":"procedure","label":"Procedimento"},{"id":"wire","label":"Fio / arco"},{"id":"notes","label":"Observações"}]},
    {"id":"notes","label":"Observações","type":"textarea"}
  ]'::jsonb),
  (_clinic_id, 'implant', 'Implantodontia', '[
    {"id":"planning","label":"Planejamento","type":"textarea"},
    {"id":"ct_scan","label":"Tomografia avaliada","type":"yes_no"},
    {"id":"graft","label":"Enxerto","type":"yes_no"},
    {"id":"implants","label":"Implantes","type":"table","columns":[{"id":"tooth","label":"Dente"},{"id":"brand","label":"Marca"},{"id":"model","label":"Modelo"},{"id":"diameter","label":"Diâmetro (mm)"},{"id":"length","label":"Comprimento (mm)"},{"id":"torque","label":"Torque (Ncm)"},{"id":"lot","label":"Lote"}]},
    {"id":"loading","label":"Carga","type":"select","options":["Imediata","Precoce","Tardia"]},
    {"id":"notes","label":"Observações","type":"textarea"}
  ]'::jsonb),
  (_clinic_id, 'endo', 'Endodontia', '[
    {"id":"tooth","label":"Dente","type":"number"},
    {"id":"diagnosis","label":"Diagnóstico","type":"select","options":["Pulpite reversível","Pulpite irreversível","Necrose pulpar","Periodontite apical","Retratamento"]},
    {"id":"canals","label":"Canais","type":"table","columns":[{"id":"canal","label":"Canal"},{"id":"apparent","label":"Comprimento aparente (mm)"},{"id":"working","label":"Odontometria (mm)"},{"id":"file","label":"Lima memória"},{"id":"cone","label":"Cone"}]},
    {"id":"medication","label":"Medicação intracanal","type":"text"},
    {"id":"sessions","label":"Sessões","type":"table","columns":[{"id":"date","label":"Data"},{"id":"procedure","label":"Procedimento"}]},
    {"id":"filled_on","label":"Obturação","type":"date"},
    {"id":"notes","label":"Observações","type":"textarea"}
  ]'::jsonb),
  (_clinic_id, 'perio', 'Periodontia', '[
    {"id":"diagnosis","label":"Diagnóstico periodontal","type":"textarea"},
    {"id":"plaque_index","label":"Índice de placa","type":"number","unit":"%"},
    {"id":"chart","label":"Periograma","type":"perio"},
    {"id":"notes","label":"Observações","type":"textarea"}
  ]'::jsonb),
  (_clinic_id, 'hof', 'Harmonização orofacial', '[
    {"id":"complaint","label":"Queixa principal","type":"textarea"},
    {"id":"applications","label":"Aplicações (mapa facial)","type":"table","columns":[{"id":"area","label":"Área"},{"id":"product","label":"Produto"},{"id":"lot","label":"Lote"},{"id":"amount","label":"Unidades / mL"},{"id":"technique","label":"Técnica"}]},
    {"id":"photos","label":"Fotos de antes registradas","type":"yes_no"},
    {"id":"return_on","label":"Retorno","type":"date"},
    {"id":"notes","label":"Observações","type":"textarea"}
  ]'::jsonb);
end;
$$;
revoke execute on function public.seed_specialty_defaults(uuid) from public, anon, authenticated;

create or replace function public.on_clinic_created_seed_documents()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_document_defaults(new.id);
  perform public.seed_finance_defaults(new.id);
  perform public.seed_agenda_defaults(new.id);
  perform public.seed_crc_defaults(new.id);
  perform public.seed_crm_defaults(new.id);
  perform public.seed_dunning_defaults(new.id);
  perform public.seed_specialty_defaults(new.id);
  return null;
end;
$$;

select public.seed_specialty_defaults(id) from public.clinics;
