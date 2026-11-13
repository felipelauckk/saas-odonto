# Especificação para desenvolvimento: sistema odontológico SaaS

Documento para entregar a um agente de IA programador. Ele define o produto, a arquitetura, o banco de dados e a ordem de construção do MVP.

## Instruções para o agente de IA

Você é o desenvolvedor sênior deste projeto. Siga esta especificação como fonte da verdade e trabalhe em etapas pequenas e testáveis.

1. Leia o documento inteiro antes de escrever código.
2. Implemente uma etapa por vez, na ordem da seção "Ordem de implementação". Não avance sem que a etapa atual funcione.
3. Antes de cada etapa, apresente um plano curto: arquivos que vai criar ou alterar, migrations e testes. Espere aprovação.
4. Ao terminar cada etapa, entregue: o que foi feito, como testar manualmente e o que ficou pendente.
5. Toda mudança de banco é uma migration SQL versionada. Nunca altere o banco direto pelo painel.
6. Todo dado de clínica tem `clinic_id` e política de RLS. Uma tabela sem RLS é um bug.
7. Não invente funcionalidades fora do escopo. Se algo estiver ambíguo, pergunte antes.
8. Interface e mensagens em português do Brasil. Código, nomes de tabelas e variáveis em inglês.
9. Datas no fuso America/Sao_Paulo. Valores em centavos (inteiro) no banco e formatados em R$ na tela.
10. Mantenha um arquivo `docs/PROGRESS.md` com o status de cada etapa e as decisões técnicas tomadas.

## Visão do produto

Sistema web de gestão para clínicas odontológicas, vendido como SaaS por mensalidade. Cada clínica se cadastra sozinha, testa e assina um plano.

| Decisão | Regra para o sistema |
| --- | --- |
| SaaS multi-clínica | Uma única aplicação e um único banco atendem todas as clínicas, isoladas por `clinic_id` e RLS |
| Cobrança por mensalidade | Teste grátis de 14 dias, planos mensais, cobrança recorrente por Pix, boleto e cartão; acesso bloqueado (só leitura) após atraso |
| Só atendimento particular | Sem convênios e sem TISS. Uma tabela de procedimentos com preço próprio por clínica |
| Uma ou várias unidades | Toda clínica nasce com uma unidade. O seletor de unidade só aparece quando houver mais de uma |

Usuários do sistema:

- **Dono/gestor:** vê tudo da clínica, todas as unidades, financeiro e configurações.
- **Dentista:** vê a própria agenda, os pacientes e o prontuário; registra evoluções e orçamentos.
- **Recepção:** agenda, cadastro de pacientes, orçamentos e recebimentos; não vê o prontuário clínico completo.
- **Superadmin (dono do SaaS):** painel interno com clínicas, planos e assinaturas; nunca vê dados de pacientes.

## Stack e arquitetura

| Camada | Tecnologia |
| --- | --- |
| Front-end e back-end | Next.js (App Router) + TypeScript |
| Interface | Tailwind CSS + shadcn/ui, responsiva (desktop primeiro, funcional no celular) |
| Banco, login e arquivos | Supabase: Postgres, Auth, Storage (imagens e documentos), Row Level Security |
| Validação | Zod em todos os formulários e rotas de servidor |
| Cobrança recorrente | Asaas (Pix, boleto, cartão), com webhook para atualizar o status da assinatura |
| WhatsApp | Camada de serviço `messaging` com interface única; provedor plugável (API oficial da Meta ou outro) |
| Tarefas agendadas | Supabase Edge Functions + cron (lembretes de consulta, vencimentos) |
| Hospedagem | Vercel (app) + Supabase (dados) |
| Testes | Vitest (regras de negócio) + Playwright (fluxos principais) |

Arquitetura multi-tenant:

- Hierarquia: **clínica → unidades → profissionais e cadeiras**.
- Ficam na clínica: pacientes, prontuário, procedimentos, orçamentos, financeiro consolidado.
- Ficam na unidade: agenda, cadeiras, caixa do dia.
- O usuário pode pertencer a mais de uma clínica (`clinic_members`); a clínica ativa fica na sessão.
- Arquivos no Storage em `clinic/{clinic_id}/...`, com política de acesso pelo mesmo `clinic_id`.

## Modelo de dados do MVP

Ponto de partida para as migrations. Toda tabela abaixo (exceto `plans` e `profiles`) tem `clinic_id`, `created_at`, `updated_at` e RLS ativa. O agente pode ajustar tipos e índices, mas deve manter as relações.

```sql
-- SaaS e acesso
plans (id, name, price_cents, max_units, max_professionals, features jsonb, active)
clinics (id, name, legal_name, document_cnpj_cpf, phone, email, logo_url,
         plan_id, subscription_status, trial_ends_at, asaas_customer_id, asaas_subscription_id)
  -- subscription_status: trialing | active | past_due | canceled
units (id, clinic_id, name, address jsonb, phone, timezone default 'America/Sao_Paulo', active)
profiles (id = auth.users.id, full_name, phone, avatar_url)
clinic_members (id, clinic_id, user_id, role, unit_ids uuid[], active)
  -- role: owner | manager | dentist | receptionist
professionals (id, clinic_id, member_id null, name, cro, specialty, color, commission_percent)
chairs (id, clinic_id, unit_id, name, active)

-- Pacientes
patients (id, clinic_id, full_name, cpf, birth_date, gender, phone, whatsapp, email,
          address jsonb, source, notes, consent_lgpd_at, archived_at)
  -- source: indicacao | instagram | google | site | outro

-- Agenda
professional_schedules (id, clinic_id, unit_id, professional_id, weekday, start_time, end_time)
schedule_blocks (id, clinic_id, unit_id, professional_id null, starts_at, ends_at, reason)
appointments (id, clinic_id, unit_id, patient_id, professional_id, chair_id null,
              starts_at, ends_at, status, type, notes, reminder_sent_at, confirmed_at)
  -- status: scheduled | confirmed | arrived | in_progress | done | no_show | canceled

-- Clínico
anamnesis_templates (id, clinic_id, name, questions jsonb)
anamneses (id, clinic_id, patient_id, template_id, answers jsonb, filled_by, signed_at)
procedures (id, clinic_id, name, code, category, price_cents, duration_min, applies_to_tooth bool, active)
tooth_records (id, clinic_id, patient_id, tooth int, faces text[], condition, notes, recorded_by)
  -- tooth: numeração FDI (11-48 permanentes, 51-85 decíduos)
  -- condition: healthy | caries | restored | missing | implant | crown | root_canal | other
clinical_notes (id, clinic_id, patient_id, professional_id, appointment_id null, body, created_at)
patient_files (id, clinic_id, patient_id, storage_path, kind, description, uploaded_by)
  -- kind: photo | xray | document | other

-- Orçamento e tratamento
treatment_plans (id, clinic_id, patient_id, professional_id, status, total_cents,
                 discount_cents, approved_at, notes)
  -- status: draft | presented | approved | partially_approved | rejected | completed
treatment_items (id, clinic_id, plan_id, procedure_id, tooth null, faces text[],
                 price_cents, status, done_at, done_by)
  -- status: pending | approved | rejected | done

-- Financeiro
payment_methods (id, clinic_id, name, fee_percent, days_to_receive)
receivables (id, clinic_id, unit_id, patient_id, plan_id null, description,
             amount_cents, due_date, installment_number, installment_total,
             status, paid_at, paid_amount_cents, payment_method_id)
  -- status: open | paid | overdue | canceled
cash_movements (id, clinic_id, unit_id, type, amount_cents, description,
                receivable_id null, occurred_at, created_by)
  -- type: in | out

-- Comunicação e auditoria
message_templates (id, clinic_id, kind, body, active)
  -- kind: appointment_reminder | appointment_confirmation | birthday
messages_log (id, clinic_id, patient_id, channel, template_kind, status, provider_id, sent_at, error)
audit_log (id, clinic_id, user_id, action, table_name, record_id, at)
```

## Módulos do MVP

Cada módulo só está pronto quando todos os critérios de aceite passam.

### 1. Cadastro, login e assinatura

- Cadastro público: nome da clínica, responsável, e-mail, WhatsApp e senha. Cria a clínica, a primeira unidade e o usuário como `owner`, em teste de 14 dias.
- Login por e-mail e senha, recuperação de senha, convite de membros por e-mail com papel definido.
- Tela de planos e assinatura via Asaas. O webhook atualiza `subscription_status`.
- Com `past_due` há mais de 7 dias: modo só leitura e aviso fixo de pagamento.

Critérios de aceite:

- [ ] Um usuário de uma clínica nunca vê dados de outra, nem chamando a API direto.
- [ ] Teste vencido sem pagamento bloqueia a criação de registros.

### 2. Configurações da clínica

- Dados e logo da clínica; unidades; cadeiras; profissionais com cor, CRO e horários de atendimento.
- Tabela de procedimentos com preço e duração; formas de pagamento com taxa; modelos de anamnese e de mensagens.
- Dados iniciais: lista padrão de procedimentos odontológicos e um modelo padrão de anamnese ao criar a clínica.

### 3. Pacientes

- Lista com busca por nome, CPF e telefone; filtros por origem e status (ativo/arquivado).
- Ficha do paciente com abas: Dados, Anamnese, Odontograma, Evoluções, Orçamentos, Financeiro, Arquivos, Agendamentos.
- Validação de CPF; CEP preenche o endereço; registro do consentimento LGPD.

### 4. Agenda

- Visões de dia e semana, por profissional ou por cadeira, filtradas pela unidade ativa.
- Criar consulta clicando no horário livre; arrastar para remarcar; impedir conflito de horário do profissional e da cadeira.
- Mudar status com um clique; cores por profissional; bloqueios de horário.
- Lembrete automático por WhatsApp 24 horas antes, com resposta de confirmação quando o provedor permitir.
- Atualização em tempo real (Supabase Realtime) para várias recepcionistas ao mesmo tempo.

Critérios de aceite:

- [ ] Duas pessoas não conseguem marcar o mesmo profissional no mesmo horário.
- [ ] Consulta marcada como "faltou" aparece no relatório de faltas.

### 5. Prontuário clínico

- Anamnese preenchida a partir do modelo, com histórico de versões e destaque de alertas (alergias, doenças).
- Odontograma visual com 32 dentes permanentes e 20 decíduos (numeração FDI), clicável por dente e face, com legenda de cores por condição.
- Evoluções clínicas com data, profissional e texto; não podem ser apagadas, só complementadas.
- Upload de fotos e radiografias com visualização em galeria.

### 6. Orçamentos e plano de tratamento

- Montar orçamento escolhendo procedimentos, inclusive a partir do odontograma (dente e faces).
- Desconto, parcelamento e forma de pagamento; gerar PDF com a identidade da clínica.
- Aprovar tudo, aprovar parte ou recusar. A aprovação gera as parcelas em `receivables`.
- Marcar itens como realizados; o plano conclui quando todos os itens aprovados forem feitos.

### 7. Financeiro básico

- Contas a receber com filtros por período, status e paciente; baixa de pagamento com forma e taxa.
- Caixa do dia por unidade, com entradas e saídas; recibo em PDF.
- Parcelas vencidas mudam para `overdue` automaticamente.

### 8. Painel inicial

- Consultas do dia, faturamento do mês, valores a receber, orçamentos em aberto e taxa de faltas, por unidade ou consolidado.

## Segurança, permissões e LGPD

Dado de saúde é dado sensível pela LGPD. Estas regras são obrigatórias desde a primeira migration.

| Recurso | Owner/Gestor | Dentista | Recepção |
| --- | --- | --- | --- |
| Configurações, unidades, membros, assinatura | Total | Nenhum | Nenhum |
| Agenda | Todas as unidades | Própria agenda | Unidades permitidas |
| Cadastro de pacientes | Total | Ler e editar | Ler e editar |
| Anamnese, odontograma, evoluções, arquivos clínicos | Ler | Total | Somente alertas da anamnese |
| Orçamentos | Total | Criar e editar | Criar e apresentar |
| Financeiro | Total | Somente os próprios recebimentos | Receber e caixa do dia |

- RLS em todas as tabelas, com funções auxiliares `current_clinic_id()` e `has_role(role)`. Nada de filtrar só no front-end.
- Chave `service_role` do Supabase só no servidor, nunca no navegador.
- `audit_log` registra quem abriu ou alterou prontuário, orçamento e financeiro.
- Arquivos clínicos em bucket privado, acesso por URL assinada de curta duração.
- Exclusão de paciente é arquivamento. O prontuário deve ser guardado por no mínimo 20 anos (regra do CFO).
- Exportação dos dados do paciente em PDF a pedido dele (direito de acesso da LGPD).
- Backups automáticos do Supabase ativos e testados.
- Senha forte e opcional de 2 fatores para owners.

## Ordem de implementação

Uma etapa por vez. Envie ao agente: "Implemente a Etapa N conforme a especificação" e valide antes de seguir.

1. **Fundação:** projeto Next.js, Supabase, Tailwind, shadcn/ui, layout com menu lateral, estrutura de pastas, `docs/PROGRESS.md`.
2. **Multi-tenant e login:** tabelas `plans`, `clinics`, `units`, `profiles`, `clinic_members`; funções de RLS; cadastro público, login, convite de membros, troca de clínica e de unidade. Teste de isolamento entre duas clínicas.
3. **Configurações:** profissionais, cadeiras, horários, procedimentos, formas de pagamento, dados iniciais.
4. **Pacientes:** lista, busca, cadastro e ficha com abas (abas ainda vazias).
5. **Agenda:** visões de dia e semana, criação, remarcação, status, conflitos, Realtime.
6. **Prontuário:** anamnese, odontograma, evoluções, arquivos.
7. **Orçamentos:** criação, PDF, aprovação total ou parcial, geração de parcelas.
8. **Financeiro:** contas a receber, baixa, caixa do dia, recibo.
9. **WhatsApp:** camada `messaging`, lembrete 24h, confirmação, log de envios.
10. **Assinatura do SaaS:** planos, Asaas, webhook, bloqueio por inadimplência, painel do superadmin.
11. **Painel inicial e acabamento:** indicadores, auditoria, testes Playwright dos fluxos principais, revisão de segurança.

## Fora do escopo agora

Não implementar no MVP. Deixar o código preparado para receber depois, sem criar telas.

- **Fase 2 — Gestão:** contas a pagar, comissões por dentista, documentos com assinatura eletrônica (receitas, atestados, contratos), estoque por unidade, NFS-e, relatórios avançados, app do dentista.
- **Fase 3 — Crescimento:** CRM de orçamentos não fechados e reativação de pacientes, campanhas segmentadas, agendamento online pelo paciente, pesquisa de satisfação, controle de prótese e laboratório, financiamento e carnê para o paciente, IA (agenda preditiva, prontuário por voz).
- **Nunca, por decisão de produto:** convênios e faturamento TISS.
