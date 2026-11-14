-- Etapa 9: mensagens (WhatsApp) — modelos editáveis e log de envios.
--
--  * Modelos: todos leem; owner/manager editam.
--  * Log: owner/manager/recepção leem; só o servidor (service role) grava.

create type public.message_kind as enum ('appointment_reminder', 'appointment_confirmation', 'birthday');
create type public.message_status as enum ('sent', 'simulated', 'failed', 'received');

create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  kind public.message_kind not null,
  body text not null check (length(trim(body)) > 0 and length(body) <= 1000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, kind)
);

create trigger message_templates_set_updated_at
  before update on public.message_templates
  for each row execute function public.set_updated_at();

create table public.messages_log (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  patient_id uuid,
  appointment_id uuid references public.appointments (id) on delete set null,
  channel text not null default 'whatsapp',
  template_kind public.message_kind,
  provider text not null,
  to_phone text,
  body text,
  status public.message_status not null,
  provider_id text,
  error text,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (patient_id, clinic_id) references public.patients (id, clinic_id) on delete restrict
);

create index messages_log_clinic_sent_idx on public.messages_log (clinic_id, sent_at desc);
create index messages_log_appointment_idx on public.messages_log (appointment_id);

create trigger messages_log_set_updated_at
  before update on public.messages_log
  for each row execute function public.set_updated_at();

alter table public.message_templates enable row level security;
alter table public.messages_log enable row level security;
revoke all on public.message_templates, public.messages_log from anon, authenticated;

grant select on public.message_templates to authenticated;
grant update (body, active) on public.message_templates to authenticated;
grant select on public.messages_log to authenticated;

create policy "modelos: membro lê" on public.message_templates for select to authenticated
  using (clinic_id = (select public.current_clinic_id()));
create policy "modelos: gestão edita" on public.message_templates for update to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')))
  with check (clinic_id = (select public.current_clinic_id()));

create policy "log: quem atende lê" on public.messages_log for select to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager', 'receptionist')));

-- Modelos padrão --------------------------------------------------------------------------

create function public.seed_message_templates(_clinic_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.message_templates (clinic_id, kind, body) values
    (_clinic_id, 'appointment_reminder',
     'Olá, {{paciente}}! Lembrete da sua consulta na {{clinica}} amanhã, {{data}}, às {{hora}}, com {{profissional}}. Toque em "Confirmar" para confirmar presença.'),
    (_clinic_id, 'appointment_confirmation',
     'Obrigado, {{paciente}}! Sua consulta de {{data}} às {{hora}} está confirmada. Até lá!'),
    (_clinic_id, 'birthday',
     'Feliz aniversário, {{paciente}}! A equipe da {{clinica}} deseja um ótimo dia.')
  on conflict (clinic_id, kind) do nothing;
$$;

revoke execute on function public.seed_message_templates(uuid) from public, anon, authenticated;

-- Clínicas novas recebem os modelos junto com os outros dados iniciais.
create or replace function public.seed_clinic_defaults(_clinic_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_message_templates(_clinic_id);

  if exists (select 1 from public.procedures where clinic_id = _clinic_id) then
    return;
  end if;

  insert into public.procedures (clinic_id, name, category, duration_min, applies_to_tooth)
  select _clinic_id, p.name, p.category, p.duration_min, p.applies_to_tooth
  from (values
    ('Consulta de avaliação', 'Diagnóstico', 30, false), ('Consulta de urgência', 'Diagnóstico', 30, false),
    ('Radiografia periapical', 'Diagnóstico', 15, true), ('Radiografia interproximal (bite-wing)', 'Diagnóstico', 15, true),
    ('Profilaxia (limpeza)', 'Prevenção', 45, false), ('Aplicação de flúor', 'Prevenção', 15, false), ('Selante', 'Prevenção', 20, true),
    ('Restauração em resina - 1 face', 'Dentística', 45, true), ('Restauração em resina - 2 faces', 'Dentística', 60, true),
    ('Restauração em resina - 3 ou mais faces', 'Dentística', 60, true), ('Clareamento de consultório', 'Estética', 90, false),
    ('Clareamento caseiro (moldeira)', 'Estética', 30, false), ('Faceta em resina', 'Estética', 90, true),
    ('Raspagem e alisamento radicular (por quadrante)', 'Periodontia', 60, false), ('Gengivectomia', 'Periodontia', 60, true),
    ('Tratamento de canal - unirradicular', 'Endodontia', 90, true), ('Tratamento de canal - pré-molar', 'Endodontia', 90, true),
    ('Tratamento de canal - molar', 'Endodontia', 120, true), ('Retratamento de canal', 'Endodontia', 120, true),
    ('Extração simples', 'Cirurgia', 45, true), ('Extração de siso', 'Cirurgia', 90, true), ('Frenectomia', 'Cirurgia', 45, false),
    ('Núcleo / pino de fibra', 'Prótese', 45, true), ('Coroa provisória', 'Prótese', 45, true), ('Coroa de cerâmica', 'Prótese', 60, true),
    ('Prótese total (dentadura)', 'Prótese', 60, false), ('Prótese parcial removível', 'Prótese', 60, false),
    ('Implante dentário', 'Implantodontia', 120, true), ('Coroa sobre implante', 'Implantodontia', 60, true),
    ('Instalação de aparelho ortodôntico fixo', 'Ortodontia', 90, false), ('Manutenção ortodôntica', 'Ortodontia', 30, false),
    ('Placa de bruxismo', 'Outros', 30, false)
  ) as p (name, category, duration_min, applies_to_tooth);

  insert into public.payment_methods (clinic_id, name, fee_percent, days_to_receive)
  values (_clinic_id, 'Dinheiro', 0, 0), (_clinic_id, 'Pix', 0, 0), (_clinic_id, 'Cartão de débito', 0, 1),
         (_clinic_id, 'Cartão de crédito', 0, 30), (_clinic_id, 'Boleto', 0, 1);

  insert into public.anamnesis_templates (clinic_id, name, is_default, questions)
  values (_clinic_id, 'Anamnese padrão', true, '[
    {"id": "tratamento_medico", "label": "Está em tratamento médico?", "type": "yes_no", "alert": false, "details": true},
    {"id": "medicamentos", "label": "Toma algum medicamento?", "type": "yes_no", "alert": false, "details": true},
    {"id": "alergias", "label": "Tem alergia a algum medicamento ou material (penicilina, anestésico, látex)?", "type": "yes_no", "alert": true, "details": true},
    {"id": "cardiaco", "label": "Tem ou teve problemas cardíacos?", "type": "yes_no", "alert": true, "details": true},
    {"id": "pressao_alta", "label": "Tem pressão alta?", "type": "yes_no", "alert": true, "details": false},
    {"id": "diabetes", "label": "Tem diabetes?", "type": "yes_no", "alert": true, "details": false},
    {"id": "coagulacao", "label": "Tem problemas de coagulação ou sangramento excessivo?", "type": "yes_no", "alert": true, "details": true},
    {"id": "infecciosas", "label": "Tem ou teve hepatite, HIV ou outra doença infecciosa?", "type": "yes_no", "alert": true, "details": true},
    {"id": "respiratorio", "label": "Tem asma ou outro problema respiratório?", "type": "yes_no", "alert": true, "details": false},
    {"id": "convulsoes", "label": "Tem epilepsia ou convulsões?", "type": "yes_no", "alert": true, "details": false},
    {"id": "gestante", "label": "Está grávida ou amamentando?", "type": "yes_no", "alert": true, "details": true},
    {"id": "reacao_anestesia", "label": "Já teve reação à anestesia dentária?", "type": "yes_no", "alert": true, "details": true},
    {"id": "fumante", "label": "Fuma?", "type": "yes_no", "alert": false, "details": false},
    {"id": "bruxismo", "label": "Range ou aperta os dentes?", "type": "yes_no", "alert": false, "details": false},
    {"id": "dor_atual", "label": "Sente dor ou sensibilidade nos dentes atualmente?", "type": "yes_no", "alert": false, "details": true},
    {"id": "observacoes", "label": "Observações", "type": "text", "alert": false, "details": false}
  ]'::jsonb);
end;
$$;

select public.seed_message_templates(id) from public.clinics;
