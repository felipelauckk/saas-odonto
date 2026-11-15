-- Etapas 26–28: recursos com IA (API do Claude, no servidor).
--
--  * Cada recurso é ligado por clínica (pode virar plano/adicional) e há um
--    limite mensal de gasto. Toda chamada registra quem pediu, o recurso e o
--    custo (ai_usage_log).
--  * Assistente de WhatsApp: conversas e mensagens (caixa de entrada da
--    equipe), modo robô ou humano, base de informações da clínica, envios de
--    acompanhamento (follow-up) das filas da CRC com limite por paciente.
--  * Resumo mensal guardado (ai_insights).

create type public.ai_feature as enum ('voice', 'assistant', 'followup', 'insights');
create type public.conversation_mode as enum ('bot', 'human');
create type public.conversation_author as enum ('patient', 'bot', 'staff', 'system');

create table public.clinic_ai_settings (
  clinic_id uuid primary key references public.clinics (id) on delete restrict,
  voice_enabled boolean not null default false,
  assistant_enabled boolean not null default false,
  followup_enabled boolean not null default false,
  insights_enabled boolean not null default false,
  monthly_limit_usd numeric(10, 2) not null default 20 check (monthly_limit_usd >= 0),
  -- Base de informações que o assistente pode usar (endereço, horários, preços divulgáveis...).
  assistant_info text not null default '' check (length(assistant_info) <= 8000),
  whatsapp_phone_number_id text check (length(whatsapp_phone_number_id) <= 40),
  followup_queues public.crc_queue[] not null default '{open_quotes,no_shows,untreated,overdue_returns}',
  followup_min_days smallint not null default 7 check (followup_min_days between 1 and 90),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index clinic_ai_settings_phone_key on public.clinic_ai_settings (whatsapp_phone_number_id) where whatsapp_phone_number_id is not null;

create table public.ai_usage_log (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  feature public.ai_feature not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  cache_write_tokens integer not null default 0,
  cost_usd numeric(12, 6) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_usage_log_clinic_idx on public.ai_usage_log (clinic_id, created_at);

create table public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  phone text not null check (phone ~ '^\d{10,13}$'),
  patient_id uuid,
  mode public.conversation_mode not null default 'bot',
  unread smallint not null default 0,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, phone),
  foreign key (patient_id, clinic_id) references public.patients (id, clinic_id) on delete set null (patient_id)
);
create index whatsapp_conversations_recent_idx on public.whatsapp_conversations (clinic_id, last_message_at desc);

create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  conversation_id uuid not null references public.whatsapp_conversations (id) on delete cascade,
  author public.conversation_author not null,
  body text not null check (length(body) <= 4000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index whatsapp_messages_conversation_idx on public.whatsapp_messages (conversation_id, created_at);

create table public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  month date not null check (extract(day from month) = 1),
  body text not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_insights_clinic_idx on public.ai_insights (clinic_id, month desc);

do $$
declare
  _table text;
begin
  foreach _table in array array['clinic_ai_settings', 'ai_usage_log', 'whatsapp_conversations', 'whatsapp_messages', 'ai_insights'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', _table || '_set_updated_at', _table);
  end loop;
  -- O registro de uso não passa pela trava de somente leitura (a cobrança da IA continua registrada).
  foreach _table in array array['clinic_ai_settings', 'whatsapp_conversations', 'whatsapp_messages', 'ai_insights'] loop
    execute format('create trigger %I before insert or update or delete on public.%I for each row execute function public.enforce_clinic_writable()', _table || '_enforce_writable', _table);
  end loop;
end;
$$;

alter table public.clinic_ai_settings enable row level security;
alter table public.ai_usage_log enable row level security;
alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.ai_insights enable row level security;
revoke all on public.clinic_ai_settings, public.ai_usage_log, public.whatsapp_conversations, public.whatsapp_messages, public.ai_insights from anon, authenticated;

grant select on public.clinic_ai_settings to authenticated;
grant insert (clinic_id, voice_enabled, assistant_enabled, followup_enabled, insights_enabled, monthly_limit_usd, assistant_info, whatsapp_phone_number_id, followup_queues, followup_min_days)
  on public.clinic_ai_settings to authenticated;
grant update (voice_enabled, assistant_enabled, followup_enabled, insights_enabled, monthly_limit_usd, assistant_info, whatsapp_phone_number_id, followup_queues, followup_min_days)
  on public.clinic_ai_settings to authenticated;
create policy "ia: membro lê" on public.clinic_ai_settings for select to authenticated using (clinic_id = (select public.current_clinic_id()));
create policy "ia: gestão cria" on public.clinic_ai_settings for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')));
create policy "ia: gestão edita" on public.clinic_ai_settings for update to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')))
  with check (clinic_id = (select public.current_clinic_id()));

grant select on public.ai_usage_log to authenticated;
create policy "uso de ia: gestão lê" on public.ai_usage_log for select to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')));

-- Caixa de entrada: recepção e gestão (o servidor grava as mensagens do robô e do paciente).
grant select on public.whatsapp_conversations, public.whatsapp_messages to authenticated;
grant update (mode, unread) on public.whatsapp_conversations to authenticated;
create policy "conversas: recepção e gestão leem" on public.whatsapp_conversations for select to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.can_use_crc()));
create policy "conversas: recepção e gestão assumem" on public.whatsapp_conversations for update to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.can_use_crc()))
  with check (clinic_id = (select public.current_clinic_id()));
create policy "mensagens: recepção e gestão leem" on public.whatsapp_messages for select to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.can_use_crc()));

grant select on public.ai_insights to authenticated;
create policy "resumos: gestão lê" on public.ai_insights for select to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')));

-- Configuração padrão (tudo desligado) para clínicas novas e existentes.
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
  perform public.seed_booking_defaults(new.id);
  insert into public.clinic_ai_settings (clinic_id) values (new.id) on conflict do nothing;
  return null;
end;
$$;

do $$
declare
  _id uuid;
begin
  for _id in select id from public.clinics loop
    begin
      insert into public.clinic_ai_settings (clinic_id) values (_id) on conflict do nothing;
    exception when foreign_key_violation then
      null;
    end;
  end loop;
end;
$$;

alter publication supabase_realtime add table public.whatsapp_messages;
