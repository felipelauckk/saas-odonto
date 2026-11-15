-- Etapa 12: documentos clínicos e assinatura eletrônica.
--
--  * Receituário (simples e de controle especial) e atestado: só quem atende
--    (can_write_clinical) emite e só quem lê o prontuário vê. Contrato, termo,
--    declaração e orientações: qualquer papel.
--  * Documento emitido não se edita (só cancela); assinado não muda nunca.
--  * O PDF é gerado e guardado só pelo servidor (pasta documents/, sem política
--    de Storage para o app).
--  * O link de assinatura só existe no envio: o banco guarda o hash SHA-256 do token.

create type public.document_kind as enum (
  'prescription', 'special_prescription', 'certificate', 'attendance', 'contract', 'consent', 'post_op', 'other'
);
create type public.document_status as enum ('issued', 'signed', 'canceled');
create type public.signature_status as enum ('pending', 'signed', 'revoked');
create type public.signature_purpose as enum ('document', 'anamnesis');

create function public.is_clinical_document(_kind public.document_kind)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select _kind in ('prescription', 'special_prescription', 'certificate');
$$;

-- Modelos ---------------------------------------------------------------------------------

create table public.document_templates (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  kind public.document_kind not null,
  name text not null check (length(trim(name)) > 0 and length(name) <= 120),
  body text not null check (length(body) <= 20000),
  -- Termo de consentimento específico de um procedimento (opcional).
  procedure_id uuid,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, clinic_id),
  foreign key (procedure_id, clinic_id) references public.procedures (id, clinic_id) on delete restrict
);
create index document_templates_clinic_idx on public.document_templates (clinic_id, kind);
create trigger document_templates_set_updated_at before update on public.document_templates
  for each row execute function public.set_updated_at();

-- Medicamentos ------------------------------------------------------------------------------

create table public.medications (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  name text not null check (length(trim(name)) > 0 and length(name) <= 160),
  presentation text check (length(presentation) <= 120),
  default_dosage text check (length(default_dosage) <= 300),
  default_quantity text check (length(default_quantity) <= 60),
  -- Antimicrobianos e controlados: receita de controle especial em 2 vias (RDC 471/2021).
  special_control boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index medications_clinic_idx on public.medications (clinic_id, name);
create trigger medications_set_updated_at before update on public.medications
  for each row execute function public.set_updated_at();

-- Documentos emitidos ------------------------------------------------------------------------

create table public.patient_documents (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  patient_id uuid not null,
  template_id uuid,
  plan_id uuid,
  professional_id uuid,
  kind public.document_kind not null,
  title text not null check (length(trim(title)) > 0 and length(title) <= 160),
  -- Texto já preenchido (cópia: o modelo pode mudar depois).
  body text not null check (length(body) <= 30000),
  -- Receituário: [{ name, presentation, dosage, quantity }]
  prescription jsonb check (prescription is null or jsonb_typeof(prescription) = 'array'),
  status public.document_status not null default 'issued',
  pdf_path text,
  pdf_sha256 text check (pdf_sha256 ~ '^[0-9a-f]{64}$'),
  created_by uuid references auth.users (id) on delete set null,
  issued_at timestamptz not null default now(),
  canceled_at timestamptz,
  canceled_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, clinic_id),
  foreign key (patient_id, clinic_id) references public.patients (id, clinic_id) on delete restrict,
  foreign key (template_id, clinic_id) references public.document_templates (id, clinic_id) on delete restrict,
  foreign key (plan_id, clinic_id) references public.treatment_plans (id, clinic_id) on delete restrict,
  foreign key (professional_id, clinic_id) references public.professionals (id, clinic_id) on delete restrict
);
create index patient_documents_patient_idx on public.patient_documents (patient_id, issued_at desc);
create trigger patient_documents_set_updated_at before update on public.patient_documents
  for each row execute function public.set_updated_at();

-- Documento emitido não se edita; assinado não muda; só o servidor marca como assinado.
create function public.guard_patient_documents()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'signed' then
    raise exception 'Documento assinado não pode ser alterado.' using errcode = 'OD001';
  end if;
  if new.title <> old.title or new.body <> old.body or new.kind <> old.kind
     or new.patient_id <> old.patient_id or new.prescription is distinct from old.prescription
     or new.professional_id is distinct from old.professional_id then
    raise exception 'Documento emitido não pode ser editado. Cancele e gere outro.' using errcode = 'OD002';
  end if;
  if old.pdf_sha256 is not null and (new.pdf_sha256 is distinct from old.pdf_sha256 or new.pdf_path is distinct from old.pdf_path) then
    raise exception 'O PDF do documento não pode ser trocado.' using errcode = 'OD002';
  end if;
  if new.status = 'signed' and (select auth.uid()) is not null then
    raise exception 'Só a assinatura do paciente marca o documento como assinado.' using errcode = 'OD003';
  end if;
  if old.status = 'canceled' and new.status <> 'canceled' then
    raise exception 'Documento cancelado não volta a valer.' using errcode = 'OD002';
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_patient_documents() from public, anon, authenticated;
create trigger patient_documents_guard before update on public.patient_documents
  for each row execute function public.guard_patient_documents();

-- Pedidos de assinatura -----------------------------------------------------------------------

create table public.signature_requests (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  patient_id uuid not null,
  purpose public.signature_purpose not null,
  document_id uuid,
  anamnesis_template_id uuid references public.anamnesis_templates (id) on delete restrict,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  status public.signature_status not null default 'pending',
  created_by uuid references auth.users (id) on delete set null,
  signed_at timestamptz,
  signer_name text check (length(signer_name) <= 160),
  signer_ip text check (length(signer_ip) <= 100),
  signer_user_agent text check (length(signer_user_agent) <= 500),
  signature_path text,
  original_sha256 text check (original_sha256 ~ '^[0-9a-f]{64}$'),
  signed_pdf_path text,
  signed_sha256 text check (signed_sha256 ~ '^[0-9a-f]{64}$'),
  anamnesis_id uuid references public.anamneses (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((purpose = 'document') = (document_id is not null)),
  check ((purpose = 'anamnesis') = (anamnesis_template_id is not null)),
  foreign key (patient_id, clinic_id) references public.patients (id, clinic_id) on delete restrict,
  foreign key (document_id, clinic_id) references public.patient_documents (id, clinic_id) on delete restrict
);
create index signature_requests_document_idx on public.signature_requests (document_id);
create index signature_requests_patient_idx on public.signature_requests (patient_id, created_at desc);
create unique index signature_requests_one_pending on public.signature_requests (document_id) where status = 'pending' and document_id is not null;
create trigger signature_requests_set_updated_at before update on public.signature_requests
  for each row execute function public.set_updated_at();

-- Permissões ---------------------------------------------------------------------------------

alter table public.document_templates enable row level security;
alter table public.medications enable row level security;
alter table public.patient_documents enable row level security;
alter table public.signature_requests enable row level security;
revoke all on public.document_templates, public.medications, public.patient_documents, public.signature_requests from anon, authenticated;

grant select on public.document_templates, public.medications to authenticated;
grant insert (clinic_id, kind, name, body, procedure_id, active) on public.document_templates to authenticated;
grant update (kind, name, body, procedure_id, active) on public.document_templates to authenticated;
grant insert (clinic_id, name, presentation, default_dosage, default_quantity, special_control, active) on public.medications to authenticated;
grant update (name, presentation, default_dosage, default_quantity, special_control, active) on public.medications to authenticated;

create policy "modelos de documento: membro lê" on public.document_templates for select to authenticated
  using (clinic_id = (select public.current_clinic_id()));
create policy "modelos de documento: gestão cria" on public.document_templates for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')));
create policy "modelos de documento: gestão edita" on public.document_templates for update to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')))
  with check (clinic_id = (select public.current_clinic_id()));

create policy "medicamentos: membro lê" on public.medications for select to authenticated
  using (clinic_id = (select public.current_clinic_id()));
-- Quem prescreve também cadastra medicamento.
create policy "medicamentos: gestão e quem atende cadastram" on public.medications for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and ((select public.has_role('owner', 'manager')) or (select public.can_write_clinical())));
create policy "medicamentos: gestão e quem atende editam" on public.medications for update to authenticated
  using (clinic_id = (select public.current_clinic_id()) and ((select public.has_role('owner', 'manager')) or (select public.can_write_clinical())))
  with check (clinic_id = (select public.current_clinic_id()));

grant select on public.patient_documents to authenticated;
grant insert (clinic_id, patient_id, template_id, plan_id, professional_id, kind, title, body, prescription, created_by)
  on public.patient_documents to authenticated;
grant update (status, canceled_at, canceled_by) on public.patient_documents to authenticated;

create policy "documentos: lê os permitidos" on public.patient_documents for select to authenticated
  using (
    clinic_id = (select public.current_clinic_id())
    and (not public.is_clinical_document(kind) or (select public.can_read_clinical()))
  );
create policy "documentos: emite os permitidos" on public.patient_documents for insert to authenticated
  with check (
    clinic_id = (select public.current_clinic_id())
    and (
      not public.is_clinical_document(kind)
      or ((select public.can_write_clinical()) and professional_id in (select public.current_professional_ids()))
    )
  );
create policy "documentos: cancela os permitidos" on public.patient_documents for update to authenticated
  using (
    clinic_id = (select public.current_clinic_id())
    and (not public.is_clinical_document(kind) or (select public.can_write_clinical()))
  )
  with check (clinic_id = (select public.current_clinic_id()) and status = 'canceled');

-- O hash do token não é legível pelo app.
grant select (id, clinic_id, patient_id, purpose, document_id, anamnesis_template_id, expires_at, status, created_by,
  signed_at, signer_name, signer_ip, signer_user_agent, original_sha256, signed_sha256, anamnesis_id, created_at, updated_at)
  on public.signature_requests to authenticated;
grant update (status) on public.signature_requests to authenticated;

create policy "assinaturas: lê as dos documentos que vê" on public.signature_requests for select to authenticated
  using (
    clinic_id = (select public.current_clinic_id())
    and (
      (purpose = 'document' and exists (select 1 from public.patient_documents d where d.id = document_id))
      or (purpose = 'anamnesis')
    )
  );
-- Revogar um link pendente (criação e assinatura são feitas pelo servidor).
create policy "assinaturas: revoga pendente" on public.signature_requests for update to authenticated
  using (clinic_id = (select public.current_clinic_id()) and status = 'pending'
         and (purpose = 'anamnesis' or exists (select 1 from public.patient_documents d where d.id = document_id)))
  with check (clinic_id = (select public.current_clinic_id()) and status = 'revoked');

-- Modo somente leitura e auditoria valem para as tabelas novas.
create trigger document_templates_enforce_writable before insert or update or delete on public.document_templates
  for each row execute function public.enforce_clinic_writable();
create trigger medications_enforce_writable before insert or update or delete on public.medications
  for each row execute function public.enforce_clinic_writable();
create trigger patient_documents_enforce_writable before insert or update or delete on public.patient_documents
  for each row execute function public.enforce_clinic_writable();
create trigger signature_requests_enforce_writable before insert or update or delete on public.signature_requests
  for each row execute function public.enforce_clinic_writable();
create trigger patient_documents_audit after insert or update or delete on public.patient_documents
  for each row execute function public.audit_changes();

-- Dados iniciais ------------------------------------------------------------------------------

create function public.seed_document_defaults(_clinic_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.document_templates where clinic_id = _clinic_id) then
    return;
  end if;

  insert into public.document_templates (clinic_id, kind, name, body) values
  (_clinic_id, 'prescription', 'Receituário simples',
'Uso oral / uso tópico conforme indicado abaixo.

{{receita.itens}}

{{clinica.cidade}}, {{data.extenso}}.'),
  (_clinic_id, 'special_prescription', 'Receituário de controle especial',
'{{receita.itens}}

{{clinica.cidade}}, {{data.extenso}}.'),
  (_clinic_id, 'certificate', 'Atestado odontológico',
'Atesto, para os devidos fins, que {{paciente.nome}}, CPF {{paciente.cpf}}, esteve sob meus cuidados profissionais nesta data, necessitando de {{dias}} dia(s) de afastamento de suas atividades a partir de hoje.

{{clinica.cidade}}, {{data.extenso}}.'),
  (_clinic_id, 'attendance', 'Declaração de comparecimento',
'Declaro, para os devidos fins, que {{paciente.nome}}, CPF {{paciente.cpf}}, compareceu a esta clínica em {{data.hoje}} para atendimento odontológico.

{{clinica.cidade}}, {{data.extenso}}.'),
  (_clinic_id, 'contract', 'Contrato de prestação de serviços odontológicos',
'CONTRATANTE: {{paciente.nome}}, CPF {{paciente.cpf}}, residente em {{paciente.endereco}}.
CONTRATADA: {{clinica.nome}}, CNPJ/CPF {{clinica.cnpj}}, com endereço em {{clinica.endereco}}.

1. OBJETO. A CONTRATADA prestará ao CONTRATANTE os serviços odontológicos descritos abaixo, conforme o plano de tratamento apresentado e aprovado:

{{orcamento.itens}}

2. VALOR. O valor total do tratamento é de {{orcamento.total}}, pago conforme as condições combinadas no orçamento.

3. OBRIGAÇÕES DO CONTRATANTE. Comparecer às consultas marcadas, avisar com antecedência em caso de falta, seguir as orientações recebidas e informar qualquer alteração em seu estado de saúde.

4. OBRIGAÇÕES DA CONTRATADA. Executar os serviços com técnica e materiais adequados, por profissional habilitado, mantendo o prontuário do CONTRATANTE conforme as normas do Conselho Federal de Odontologia.

5. RESULTADOS. O CONTRATANTE declara ter sido informado de que a odontologia é atividade de meio e de que os resultados dependem também de fatores biológicos e de sua colaboração.

6. DESISTÊNCIA. Em caso de desistência, serão devidos os valores dos procedimentos já realizados e dos materiais já adquiridos para o tratamento.

7. FORO. Fica eleito o foro da comarca de {{clinica.cidade}} para dirimir eventuais dúvidas.

{{clinica.cidade}}, {{data.extenso}}.'),
  (_clinic_id, 'consent', 'Termo de consentimento livre e esclarecido',
'Eu, {{paciente.nome}}, CPF {{paciente.cpf}}, declaro que fui informado(a) de forma clara pelo(a) profissional {{profissional.nome}} ({{profissional.cro}}) sobre o procedimento {{procedimento.nome}}, seus objetivos, benefícios, riscos, possíveis complicações e alternativas de tratamento, e que tive a oportunidade de fazer perguntas, todas respondidas de forma satisfatória.

Estou ciente de que posso revogar este consentimento a qualquer momento antes da realização do procedimento.

Autorizo a realização do procedimento descrito.

{{clinica.cidade}}, {{data.extenso}}.'),
  (_clinic_id, 'post_op', 'Orientações pós-operatórias',
'Orientações para {{paciente.nome}}:

- Morda a gaze por 30 minutos e não cuspa nas primeiras 24 horas.
- Faça compressas frias no rosto nas primeiras 24 horas (20 minutos com intervalos).
- Alimente-se de comidas frias ou mornas e pastosas nos primeiros dias.
- Não faça bochechos nem use canudo nas primeiras 24 horas.
- Evite esforço físico, sol, álcool e cigarro por 3 dias.
- Escove os dentes normalmente, com cuidado na região operada.
- Tome os medicamentos conforme a receita.
- Em caso de sangramento intenso, febre ou dor forte que não passa com a medicação, entre em contato com a clínica.

{{clinica.nome}}');

  insert into public.medications (clinic_id, name, presentation, default_dosage, default_quantity, special_control)
  select _clinic_id, m.name, m.presentation, m.dosage, m.quantity, m.special
  from (values
    ('Amoxicilina', '500 mg cápsula', 'Tomar 1 cápsula de 8 em 8 horas por 7 dias.', '21 cápsulas', true),
    ('Amoxicilina + clavulanato de potássio', '875 mg + 125 mg comprimido', 'Tomar 1 comprimido de 12 em 12 horas por 7 dias.', '14 comprimidos', true),
    ('Azitromicina', '500 mg comprimido', 'Tomar 1 comprimido ao dia por 3 dias.', '3 comprimidos', true),
    ('Clindamicina', '300 mg cápsula', 'Tomar 1 cápsula de 6 em 6 horas por 7 dias.', '28 cápsulas', true),
    ('Cefalexina', '500 mg cápsula', 'Tomar 1 cápsula de 6 em 6 horas por 7 dias.', '28 cápsulas', true),
    ('Metronidazol', '400 mg comprimido', 'Tomar 1 comprimido de 8 em 8 horas por 7 dias.', '21 comprimidos', true),
    ('Amoxicilina (profilaxia)', '500 mg cápsula', 'Tomar 4 cápsulas 1 hora antes do procedimento.', '4 cápsulas', true),
    ('Ibuprofeno', '600 mg comprimido', 'Tomar 1 comprimido de 8 em 8 horas por 3 dias, após as refeições.', '9 comprimidos', false),
    ('Nimesulida', '100 mg comprimido', 'Tomar 1 comprimido de 12 em 12 horas por 3 dias, após as refeições.', '6 comprimidos', false),
    ('Cetoprofeno', '100 mg comprimido', 'Tomar 1 comprimido de 12 em 12 horas por 3 dias, após as refeições.', '6 comprimidos', false),
    ('Diclofenaco de potássio', '50 mg comprimido', 'Tomar 1 comprimido de 8 em 8 horas por 3 dias, após as refeições.', '9 comprimidos', false),
    ('Dexametasona', '4 mg comprimido', 'Tomar 2 comprimidos 1 hora antes do procedimento.', '2 comprimidos', false),
    ('Dipirona sódica', '500 mg comprimido', 'Tomar 1 comprimido de 6 em 6 horas em caso de dor.', '12 comprimidos', false),
    ('Dipirona sódica', '1 g comprimido', 'Tomar 1 comprimido de 6 em 6 horas em caso de dor.', '8 comprimidos', false),
    ('Paracetamol', '750 mg comprimido', 'Tomar 1 comprimido de 6 em 6 horas em caso de dor.', '12 comprimidos', false),
    ('Paracetamol + codeína', '500 mg + 30 mg comprimido', 'Tomar 1 comprimido de 6 em 6 horas em caso de dor intensa.', '8 comprimidos', true),
    ('Tramadol', '50 mg cápsula', 'Tomar 1 cápsula de 8 em 8 horas em caso de dor intensa.', '6 cápsulas', true),
    ('Digluconato de clorexidina', '0,12% solução', 'Bochechar 15 ml por 1 minuto, 2 vezes ao dia, por 7 dias.', '1 frasco', false),
    ('Nistatina', '100.000 UI/ml suspensão oral', 'Bochechar 5 ml e engolir, 4 vezes ao dia, por 14 dias.', '1 frasco', false),
    ('Miconazol', '20 mg/g gel oral', 'Aplicar na lesão 4 vezes ao dia por 10 dias.', '1 bisnaga', false),
    ('Aciclovir', '50 mg/g creme', 'Aplicar na lesão 5 vezes ao dia por 5 dias.', '1 bisnaga', false),
    ('Triancinolona acetonida', '1 mg/g pomada oral', 'Aplicar na lesão 3 vezes ao dia, após as refeições.', '1 bisnaga', false),
    ('Benzocaína', 'gel tópico', 'Aplicar no local antes das refeições, se necessário.', '1 bisnaga', false),
    ('Loratadina', '10 mg comprimido', 'Tomar 1 comprimido ao dia por 5 dias.', '5 comprimidos', false),
    ('Omeprazol', '20 mg cápsula', 'Tomar 1 cápsula em jejum, por 7 dias.', '7 cápsulas', false)
  ) as m (name, presentation, dosage, quantity, special);
end;
$$;
revoke execute on function public.seed_document_defaults(uuid) from public, anon, authenticated;

-- Toda clínica nova recebe os modelos (o gatilho roda logo após criar a clínica).
create function public.on_clinic_created_seed_documents()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_document_defaults(new.id);
  return null;
end;
$$;
revoke execute on function public.on_clinic_created_seed_documents() from public, anon, authenticated;
create trigger clinics_seed_documents after insert on public.clinics
  for each row execute function public.on_clinic_created_seed_documents();

select public.seed_document_defaults(id) from public.clinics;
