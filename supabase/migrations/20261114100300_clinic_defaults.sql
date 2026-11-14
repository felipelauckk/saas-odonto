-- Etapa 3: dados iniciais de toda clínica nova.
-- Procedimentos comuns (preço R$ 0,00: a clínica define os seus), formas de
-- pagamento básicas (sem taxa) e um modelo padrão de anamnese.

create function public.seed_clinic_defaults(_clinic_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.procedures where clinic_id = _clinic_id) then
    return; -- já tem dados: não duplica
  end if;

  insert into public.procedures (clinic_id, name, category, duration_min, applies_to_tooth)
  select _clinic_id, p.name, p.category, p.duration_min, p.applies_to_tooth
  from (values
    ('Consulta de avaliação',                          'Diagnóstico',    30,  false),
    ('Consulta de urgência',                           'Diagnóstico',    30,  false),
    ('Radiografia periapical',                         'Diagnóstico',    15,  true),
    ('Radiografia interproximal (bite-wing)',          'Diagnóstico',    15,  true),
    ('Profilaxia (limpeza)',                           'Prevenção',      45,  false),
    ('Aplicação de flúor',                             'Prevenção',      15,  false),
    ('Selante',                                        'Prevenção',      20,  true),
    ('Restauração em resina - 1 face',                 'Dentística',     45,  true),
    ('Restauração em resina - 2 faces',                'Dentística',     60,  true),
    ('Restauração em resina - 3 ou mais faces',        'Dentística',     60,  true),
    ('Clareamento de consultório',                     'Estética',       90,  false),
    ('Clareamento caseiro (moldeira)',                 'Estética',       30,  false),
    ('Faceta em resina',                               'Estética',       90,  true),
    ('Raspagem e alisamento radicular (por quadrante)', 'Periodontia',   60,  false),
    ('Gengivectomia',                                  'Periodontia',    60,  true),
    ('Tratamento de canal - unirradicular',            'Endodontia',     90,  true),
    ('Tratamento de canal - pré-molar',                'Endodontia',     90,  true),
    ('Tratamento de canal - molar',                    'Endodontia',     120, true),
    ('Retratamento de canal',                          'Endodontia',     120, true),
    ('Extração simples',                               'Cirurgia',       45,  true),
    ('Extração de siso',                               'Cirurgia',       90,  true),
    ('Frenectomia',                                    'Cirurgia',       45,  false),
    ('Núcleo / pino de fibra',                         'Prótese',        45,  true),
    ('Coroa provisória',                               'Prótese',        45,  true),
    ('Coroa de cerâmica',                              'Prótese',        60,  true),
    ('Prótese total (dentadura)',                      'Prótese',        60,  false),
    ('Prótese parcial removível',                      'Prótese',        60,  false),
    ('Implante dentário',                              'Implantodontia', 120, true),
    ('Coroa sobre implante',                           'Implantodontia', 60,  true),
    ('Instalação de aparelho ortodôntico fixo',        'Ortodontia',     90,  false),
    ('Manutenção ortodôntica',                         'Ortodontia',     30,  false),
    ('Placa de bruxismo',                              'Outros',         30,  false)
  ) as p (name, category, duration_min, applies_to_tooth);

  insert into public.payment_methods (clinic_id, name, fee_percent, days_to_receive)
  values
    (_clinic_id, 'Dinheiro', 0, 0),
    (_clinic_id, 'Pix', 0, 0),
    (_clinic_id, 'Cartão de débito', 0, 1),
    (_clinic_id, 'Cartão de crédito', 0, 30),
    (_clinic_id, 'Boleto', 0, 1);

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

revoke execute on function public.seed_clinic_defaults(uuid) from public, anon, authenticated;

-- Cadastro passa a criar os dados iniciais junto com a clínica.
create or replace function public.handle_new_user()
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

    perform public.seed_clinic_defaults(_clinic_id);
  end if;

  return new;
end;
$$;

-- Clínicas que já existiam recebem os dados iniciais uma vez.
select public.seed_clinic_defaults(id) from public.clinics;
