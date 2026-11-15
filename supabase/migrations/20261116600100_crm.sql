-- Etapa 17: CRM de captação.
--
--  * Leads (ainda não são pacientes) num funil de etapas configuráveis. As
--    etapas padrão têm uma chave (auto_key) usada pela automação: depois de
--    convertido em paciente, marcar consulta, comparecer, apresentar e aprovar
--    orçamento movem o lead para a frente sozinhos (nunca para trás).
--  * Campanhas com valor investido (custo por lead) e parceiros que indicam.
--  * Formulário público: cada clínica tem um token (link /captacao/<token>).
--  * Recepção e gestão usam o CRM (can_use_crc); só a gestão configura.

create type public.lead_source as enum ('instagram', 'google', 'indicacao', 'site', 'anuncio', 'passante', 'outro');
create type public.crm_stage_kind as enum ('open', 'won', 'lost');

create table public.crm_stages (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  name text not null check (length(trim(name)) > 0 and length(name) <= 40),
  position smallint not null,
  kind public.crm_stage_kind not null default 'open',
  auto_key text check (auto_key in ('new', 'talking', 'evaluation_scheduled', 'attended', 'quote_presented', 'won', 'lost')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, clinic_id),
  unique (clinic_id, auto_key)
);

create table public.crm_campaigns (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  name text not null check (length(trim(name)) > 0 and length(name) <= 80),
  source public.lead_source,
  cost_cents integer not null default 0 check (cost_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, clinic_id),
  unique (clinic_id, name)
);

create table public.referral_partners (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  name text not null check (length(trim(name)) > 0 and length(name) <= 120),
  phone text check (phone ~ '^\d{10,11}$'),
  notes text check (length(notes) <= 300),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, clinic_id)
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  name text not null check (length(trim(name)) > 1 and length(name) <= 160),
  phone text check (phone ~ '^\d{10,11}$'),
  email text check (length(email) <= 160),
  source public.lead_source not null default 'outro',
  campaign_id uuid,
  procedure_id uuid,
  interest text check (length(interest) <= 160),
  notes text check (length(notes) <= 1000),
  stage_id uuid not null,
  stage_changed_at timestamptz not null default now(),
  lost_reason text check (length(lost_reason) <= 200),
  patient_id uuid,
  referred_by_patient_id uuid,
  referred_by_partner_id uuid,
  from_public_form boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (referred_by_patient_id is null or referred_by_partner_id is null),
  foreign key (stage_id, clinic_id) references public.crm_stages (id, clinic_id) on delete restrict,
  foreign key (campaign_id, clinic_id) references public.crm_campaigns (id, clinic_id) on delete set null (campaign_id),
  foreign key (procedure_id, clinic_id) references public.procedures (id, clinic_id) on delete set null (procedure_id),
  foreign key (patient_id, clinic_id) references public.patients (id, clinic_id) on delete restrict,
  foreign key (referred_by_patient_id, clinic_id) references public.patients (id, clinic_id) on delete restrict,
  foreign key (referred_by_partner_id, clinic_id) references public.referral_partners (id, clinic_id) on delete restrict
);
create index leads_clinic_stage_idx on public.leads (clinic_id, stage_id);
create index leads_patient_idx on public.leads (patient_id) where patient_id is not null;

-- Indicação também fica no paciente (convertido ou cadastrado direto).
alter table public.patients add column referred_by_patient_id uuid;
alter table public.patients add column referred_by_partner_id uuid;
alter table public.patients add constraint patients_referred_patient_fk
  foreign key (referred_by_patient_id, clinic_id) references public.patients (id, clinic_id) on delete restrict;
alter table public.patients add constraint patients_referred_partner_fk
  foreign key (referred_by_partner_id, clinic_id) references public.referral_partners (id, clinic_id) on delete restrict;
grant insert (referred_by_patient_id, referred_by_partner_id) on public.patients to authenticated;
grant update (referred_by_patient_id, referred_by_partner_id) on public.patients to authenticated;

-- Token do formulário público.
alter table public.clinics add column lead_form_token text not null default replace(gen_random_uuid()::text, '-', '');
create unique index clinics_lead_form_token_key on public.clinics (lead_form_token);

do $$
declare
  _table text;
begin
  foreach _table in array array['crm_stages', 'crm_campaigns', 'referral_partners', 'leads'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', _table || '_set_updated_at', _table);
    execute format('create trigger %I before insert or update or delete on public.%I for each row execute function public.enforce_clinic_writable()', _table || '_enforce_writable', _table);
  end loop;
end;
$$;

create trigger leads_audit after insert or update or delete on public.leads
  for each row execute function public.audit_changes();

-- Regras do lead: motivo obrigatório ao perder; data de mudança de etapa.
create function public.guard_leads()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _kind public.crm_stage_kind;
begin
  select kind into _kind from public.crm_stages where id = new.stage_id;
  if _kind = 'lost' and coalesce(trim(new.lost_reason), '') = '' then
    raise exception 'Informe o motivo da perda.' using errcode = 'OC001';
  end if;
  if _kind <> 'lost' then
    new.lost_reason := null;
  end if;
  if tg_op = 'UPDATE' and new.stage_id is distinct from old.stage_id then
    new.stage_changed_at := now();
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_leads() from public, anon, authenticated;
create trigger leads_guard before insert or update on public.leads for each row execute function public.guard_leads();

-- Etapas automáticas só renomeiam; as criadas pela clínica podem sair se vazias.
create function public.guard_crm_stages()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.auto_key is not null and (select auth.uid()) is not null then
      raise exception 'Etapas padrão do funil não podem ser excluídas.' using errcode = 'OC002';
    end if;
    return old;
  end if;
  if new.auto_key is distinct from old.auto_key or new.kind is distinct from old.kind then
    raise exception 'O tipo da etapa não pode mudar.' using errcode = 'OC002';
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_crm_stages() from public, anon, authenticated;
create trigger crm_stages_guard before update or delete on public.crm_stages for each row execute function public.guard_crm_stages();

-- Automação do funil ----------------------------------------------------------------------

create function public.crm_advance(_clinic_id uuid, _patient_id uuid, _key text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.leads l
     set stage_id = target.id
    from public.crm_stages target, public.crm_stages cur
   where l.clinic_id = _clinic_id
     and l.patient_id = _patient_id
     and target.clinic_id = _clinic_id
     and target.auto_key = _key
     and cur.id = l.stage_id
     and cur.kind = 'open'
     and cur.position < target.position;
$$;
revoke execute on function public.crm_advance(uuid, uuid, text) from public, anon, authenticated;

create function public.crm_on_appointment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.status not in ('canceled', 'no_show') then
    perform public.crm_advance(new.clinic_id, new.patient_id, 'evaluation_scheduled');
  end if;
  if new.status in ('arrived', 'in_progress', 'done') and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    perform public.crm_advance(new.clinic_id, new.patient_id, 'attended');
  end if;
  return null;
end;
$$;
revoke execute on function public.crm_on_appointment() from public, anon, authenticated;
create trigger appointments_crm after insert or update of status on public.appointments
  for each row execute function public.crm_on_appointment();

create function public.crm_on_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'presented' then
      perform public.crm_advance(new.clinic_id, new.patient_id, 'quote_presented');
    elsif new.status in ('approved', 'partially_approved') then
      perform public.crm_advance(new.clinic_id, new.patient_id, 'won');
    end if;
  end if;
  return null;
end;
$$;
revoke execute on function public.crm_on_plan() from public, anon, authenticated;
create trigger treatment_plans_crm after update of status on public.treatment_plans
  for each row execute function public.crm_on_plan();

-- Converter em paciente: lead convertido já com consulta/orçamento acompanha o estado atual.
create function public.crm_on_lead_converted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.patient_id is not null and old.patient_id is null then
    if exists (select 1 from public.treatment_plans p where p.patient_id = new.patient_id and p.status in ('approved', 'partially_approved', 'completed')) then
      perform public.crm_advance(new.clinic_id, new.patient_id, 'won');
    elsif exists (select 1 from public.treatment_plans p where p.patient_id = new.patient_id and p.status = 'presented') then
      perform public.crm_advance(new.clinic_id, new.patient_id, 'quote_presented');
    elsif exists (select 1 from public.appointments a where a.patient_id = new.patient_id and a.status in ('arrived', 'in_progress', 'done')) then
      perform public.crm_advance(new.clinic_id, new.patient_id, 'attended');
    elsif exists (select 1 from public.appointments a where a.patient_id = new.patient_id and a.starts_at > now() and a.status not in ('canceled', 'no_show')) then
      perform public.crm_advance(new.clinic_id, new.patient_id, 'evaluation_scheduled');
    end if;
  end if;
  return null;
end;
$$;
revoke execute on function public.crm_on_lead_converted() from public, anon, authenticated;
create trigger leads_converted after update of patient_id on public.leads
  for each row execute function public.crm_on_lead_converted();

-- Permissões ------------------------------------------------------------------------------

alter table public.crm_stages enable row level security;
alter table public.crm_campaigns enable row level security;
alter table public.referral_partners enable row level security;
alter table public.leads enable row level security;
revoke all on public.crm_stages, public.crm_campaigns, public.referral_partners, public.leads from anon, authenticated;

grant select, delete on public.crm_stages to authenticated;
grant insert (clinic_id, name, position) on public.crm_stages to authenticated;
grant update (name, position) on public.crm_stages to authenticated;
create policy "funil: recepção e gestão leem" on public.crm_stages for select to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.can_use_crc()));
create policy "funil: gestão cria" on public.crm_stages for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')));
create policy "funil: gestão edita" on public.crm_stages for update to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')))
  with check (clinic_id = (select public.current_clinic_id()));
create policy "funil: gestão apaga" on public.crm_stages for delete to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')));

grant select on public.crm_campaigns, public.referral_partners to authenticated;
grant insert (clinic_id, name, source, cost_cents, active) on public.crm_campaigns to authenticated;
grant update (name, source, cost_cents, active) on public.crm_campaigns to authenticated;
create policy "campanhas: recepção e gestão leem" on public.crm_campaigns for select to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.can_use_crc()));
create policy "campanhas: gestão cria" on public.crm_campaigns for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')));
create policy "campanhas: gestão edita" on public.crm_campaigns for update to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')))
  with check (clinic_id = (select public.current_clinic_id()));

grant insert (clinic_id, name, phone, notes, active) on public.referral_partners to authenticated;
grant update (name, phone, notes, active) on public.referral_partners to authenticated;
-- Parceiros aparecem na ficha do paciente (indicado por), então todo membro lê.
create policy "parceiros: membro lê" on public.referral_partners for select to authenticated
  using (clinic_id = (select public.current_clinic_id()));
create policy "parceiros: recepção e gestão cadastram" on public.referral_partners for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and (select public.can_use_crc()));
create policy "parceiros: recepção e gestão editam" on public.referral_partners for update to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.can_use_crc()))
  with check (clinic_id = (select public.current_clinic_id()));

grant select on public.leads to authenticated;
grant insert (clinic_id, name, phone, email, source, campaign_id, procedure_id, interest, notes, stage_id, lost_reason,
              referred_by_patient_id, referred_by_partner_id, created_by) on public.leads to authenticated;
grant update (name, phone, email, source, campaign_id, procedure_id, interest, notes, stage_id, lost_reason, patient_id,
              referred_by_patient_id, referred_by_partner_id) on public.leads to authenticated;
create policy "leads: recepção e gestão leem" on public.leads for select to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.can_use_crc()));
create policy "leads: recepção e gestão criam" on public.leads for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and (select public.can_use_crc()));
create policy "leads: recepção e gestão editam" on public.leads for update to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.can_use_crc()))
  with check (clinic_id = (select public.current_clinic_id()));
-- Sem DELETE: lead perdido fica no histórico (relatório de conversão).

-- Novo link do formulário público (o antigo deixa de funcionar).
create function public.regenerate_lead_form_token()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  _token text := replace(gen_random_uuid()::text, '-', '');
begin
  if not public.has_role('owner', 'manager') then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  update public.clinics set lead_form_token = _token where id = public.current_clinic_id();
  return _token;
end;
$$;
revoke execute on function public.regenerate_lead_form_token() from public, anon;
grant execute on function public.regenerate_lead_form_token() to authenticated;

-- Funil padrão ------------------------------------------------------------------------------

create function public.seed_crm_defaults(_clinic_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.crm_stages (clinic_id, name, position, kind, auto_key) values
    (_clinic_id, 'Novo contato', 10, 'open', 'new'),
    (_clinic_id, 'Em conversa', 20, 'open', 'talking'),
    (_clinic_id, 'Avaliação agendada', 30, 'open', 'evaluation_scheduled'),
    (_clinic_id, 'Compareceu', 40, 'open', 'attended'),
    (_clinic_id, 'Orçamento apresentado', 50, 'open', 'quote_presented'),
    (_clinic_id, 'Fechou', 90, 'won', 'won'),
    (_clinic_id, 'Perdido', 100, 'lost', 'lost')
  on conflict (clinic_id, auto_key) do nothing;
$$;
revoke execute on function public.seed_crm_defaults(uuid) from public, anon, authenticated;

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
  return null;
end;
$$;

select public.seed_crm_defaults(id) from public.clinics;

alter publication supabase_realtime add table public.leads;
