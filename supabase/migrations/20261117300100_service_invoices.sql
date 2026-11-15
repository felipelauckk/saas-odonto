-- Etapa 25: nota fiscal de serviço (NFS-e) pela conta Asaas da clínica.
--
--  * Configuração fiscal da clínica (código de serviço municipal, alíquota de
--    ISS, regime, inscrição municipal). O certificado A1 é enviado direto ao
--    Asaas e não fica guardado aqui.
--  * Uma nota por recebimento (ou avulsa), emitida a partir da baixa — manual
--    ou automática — e atualizada pelo webhook do Asaas da clínica.
--  * Quem opera o financeiro lê; a emissão e o cancelamento passam pelo
--    servidor (que confere a permissão antes).

create type public.invoice_status as enum ('processing', 'authorized', 'canceled', 'error');

create table public.clinic_fiscal_settings (
  clinic_id uuid primary key references public.clinics (id) on delete restrict,
  enabled boolean not null default false,
  auto_issue boolean not null default false,
  municipal_inscription text check (length(municipal_inscription) <= 30),
  simples_nacional boolean not null default true,
  cnae text check (length(cnae) <= 20),
  municipal_service_code text check (length(municipal_service_code) <= 30),
  municipal_service_name text check (length(municipal_service_name) <= 300),
  service_description text not null default 'Serviços odontológicos' check (length(service_description) between 1 and 500),
  iss_rate numeric(5, 2) not null default 0 check (iss_rate between 0 and 10),
  retain_iss boolean not null default false,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_invoices (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete restrict,
  patient_id uuid not null,
  receivable_id uuid references public.receivables (id) on delete set null,
  amount_cents integer not null check (amount_cents > 0),
  description text not null check (length(description) <= 500),
  status public.invoice_status not null default 'processing',
  asaas_invoice_id text,
  number text,
  pdf_url text,
  xml_url text,
  error text check (length(error) <= 500),
  issued_at timestamptz,
  canceled_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (patient_id, clinic_id) references public.patients (id, clinic_id) on delete restrict
);
create index service_invoices_clinic_idx on public.service_invoices (clinic_id, created_at desc);
-- Uma nota válida por recebimento (cancelada ou com erro permite emitir de novo).
create unique index service_invoices_receivable_key on public.service_invoices (receivable_id) where status in ('processing', 'authorized');

do $$
declare
  _table text;
begin
  foreach _table in array array['clinic_fiscal_settings', 'service_invoices'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', _table || '_set_updated_at', _table);
    execute format('create trigger %I before insert or update or delete on public.%I for each row execute function public.enforce_clinic_writable()', _table || '_enforce_writable', _table);
  end loop;
end;
$$;

create trigger service_invoices_audit after insert or update or delete on public.service_invoices
  for each row execute function public.audit_changes();

alter table public.clinic_fiscal_settings enable row level security;
alter table public.service_invoices enable row level security;
revoke all on public.clinic_fiscal_settings, public.service_invoices from anon, authenticated;

grant select on public.clinic_fiscal_settings to authenticated;
grant insert (clinic_id, enabled, auto_issue, municipal_inscription, simples_nacional, cnae, municipal_service_code, municipal_service_name, service_description, iss_rate, retain_iss)
  on public.clinic_fiscal_settings to authenticated;
grant update (enabled, auto_issue, municipal_inscription, simples_nacional, cnae, municipal_service_code, municipal_service_name, service_description, iss_rate, retain_iss)
  on public.clinic_fiscal_settings to authenticated;
create policy "fiscal: quem opera o financeiro lê" on public.clinic_fiscal_settings for select to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.can_operate_finance()));
create policy "fiscal: gestão cria" on public.clinic_fiscal_settings for insert to authenticated
  with check (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')));
create policy "fiscal: gestão edita" on public.clinic_fiscal_settings for update to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.has_role('owner', 'manager')))
  with check (clinic_id = (select public.current_clinic_id()));

grant select on public.service_invoices to authenticated;
create policy "notas: quem opera o financeiro lê" on public.service_invoices for select to authenticated
  using (clinic_id = (select public.current_clinic_id()) and (select public.can_operate_finance()));
-- Gravação só pelo servidor (emissão, webhook e cancelamento).
