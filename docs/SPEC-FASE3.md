# Especificação — Fase 3: agenda, cadastro e ficha mais completos

> Para o Claude Code. Leia este arquivo inteiro antes de começar. Execute **uma etapa por vez**, na ordem. Ao fim de cada etapa: testes passando, prints `antes-pX-*` e `depois-pX-*` em `docs/design/screens/`, linha nova em `docs/PROGRESS.md` (mesmo formato das etapas do Redesign 2.0) e um commit `Fase 3 PX: <resumo>`.

## 0. Contexto e regras

- Este documento diz **o que** fazer em cada etapa, a partir do que a Arcada já tem hoje. O visual segue o **Redesign 2.0** (`docs/REDESIGN.md` > "Redesign 2.0") e as telas atuais do sistema.
- Regras do projeto continuam valendo (`CLAUDE.md`): multi-clínica com `clinic_id` + RLS em toda tabela nova, papéis por `has_role()`, Zod nos formulários e nas actions, textos em português do Brasil, sem convênio/TISS (só particular).
- Toda tabela nova: `clinic_id`, `created_at`, `updated_at` (gatilho `set_updated_at`), RLS habilitada, `revoke all ... from anon, authenticated` e políticas explícitas, teste de RLS no padrão de `*-rls.test.ts` (uma clínica não lê nem escreve na outra; papéis sem permissão recebem erro).
- Migrations novas com prefixo de data depois de `20261118200100`.
- Nada de regra ou permissão existente pode mudar sem estar escrito aqui. Em dúvida, mantenha como está e anote em "Pendências" no `PROGRESS.md`.

### Visual (Redesign 2.0) a seguir em tudo

- Fundo `--background` (#F3F4F7), cartões brancos `rounded-card` (20px) com `shadow-card` e borda `--border`. Controles com raio 12px e 40px de altura (44px no toque).
- Montserrat. Títulos de página em Black (`type-display`), títulos de seção e rótulos em pesos médios.
- Botão principal verde-azulado `--primary` com `shadow-primary`. Secundário branco com borda.
- Filtro ou aba selecionada em pílula escura (tinta), como em Pacientes e Financeiro.
- Tons pastel (`tint-sky`, `tint-mint`, `tint-lilac`, `tint-peach`, `tint-rose`) **só** em detalhes: quadrado de ícone, etiqueta, avatar. Nunca no fundo de um cartão inteiro.
- No máximo **um** `bg-hero` (degradê) por tela.
- Formulários longos: `FormSections` (título e explicação à esquerda, campos à direita), como em Configurações > Dados da clínica.
- Diálogos e painéis laterais: cabeçalho com título e fechar, corpo com rolagem própria, rodapé fixo com Cancelar e ação principal.
- Estado, valor e alerta sempre **escritos**, nunca só cor.

---

## P1. Nova consulta mais rápida (diálogo da agenda)

**Hoje:** `src/features/agenda/components/appointment-form.tsx` tem paciente, profissional, data, início (campo de hora), duração, um procedimento opcional, cadeira, marcadores, repetir, descrição e observações.


### O que fazer

1. **Abas no topo do diálogo:** `SegmentedControl` "Consulta | Compromisso". A aba Compromisso é a P2. O título do diálogo muda junto ("Nova consulta" / "Novo compromisso").
2. **Paciente:** depois de escolhido no `patient-picker`, mostrar uma linha com celular/WhatsApp e e-mail (ou "sem e-mail") e um link **"Editar cadastro"** que abre o cadastro num painel lateral (o mesmo de "Novo paciente") sem perder o que já foi preenchido na consulta. Mostrar também, se houver: etiqueta vermelha de alerta da anamnese ("Alergia a …") e etiqueta "Primeira vez" (calculada como já é hoje, só leitura; não criar caixa de marcar).
3. **Vários procedimentos por consulta:**
   - Tabela nova `appointment_procedures (id, clinic_id, appointment_id, procedure_id, tooth text null, faces text[] null, position int)`.
   - Migrar o `appointments.procedure_id` existente para uma linha nessa tabela; manter a coluna por compatibilidade numa primeira versão e parar de escrever nela (anotar no PROGRESS para remover depois).
   - Botão "+ Adicionar procedimento" abre o catálogo com busca (o mesmo componente do orçamento). Se o paciente tem plano aprovado com itens não feitos, mostrar primeiro **"Do plano de tratamento"** com esses itens para um clique.
   - A soma das durações padrão dos procedimentos sugere a duração (se o procedimento não tem duração, manter a escolhida).
4. **Grade de horários:**
   - Substituir o campo de hora por uma grade de botões (chips) com os horários **livres** do profissional no dia, de 15 em 15 min, separados em **Manhã / Tarde / Noite** (mesmos cortes da lista de espera: até 12h, até 18h, depois).
   - Horário ocupado por consulta ou bloqueio não aparece. Fora do expediente do profissional também não, mas há um link "Mostrar fora do expediente" que libera todos (com aviso).
   - Mudar data, profissional ou duração recalcula a grade. Selecionado = chip em `--primary` com texto branco.
   - Reaproveitar a lógica de horários livres do agendamento online (Etapa 24); se precisar, extrair para `src/features/agenda/free-slots.ts` com testes.
   - Quando o diálogo vem de um clique na grade da agenda, o horário clicado já vem selecionado.
5. **Mensagens desta consulta** (bloco no fim do formulário):
   - "Pedir confirmação": `Automático (padrão da clínica)` · `Não enviar` · `Enviar agora`.
   - "Lembrete na véspera": `Automático` · `Não enviar`.
   - Canal: hoje só WhatsApp; mostrar como texto fixo "Pelo WhatsApp" (deixar preparado para e-mail).
   - Colunas novas em `appointments`: `confirmation_mode text check in ('auto','none','now') default 'auto'`, `reminder_mode text check in ('auto','none') default 'auto'`. A rotina de lembrete passa a pular `reminder_mode = 'none'`.
   - Se a consulta é para hoje: escrever abaixo "O lembrete automático não sai para consultas de hoje." e desabilitar a opção.
6. **Repetição** continua como está (série de até 52), só com o visual novo: "Repetir: Não repetir / Toda semana / A cada 15 dias / Todo mês" + "Quantas vezes".
7. **Rodapé fixo:** resumo à esquerda ("Qui, 26/11 · 15:30–16:15 · Dra. Ana") e "Cancelar" + "Marcar consulta" à direita.

### Aceite

- Marcar consulta com 3 procedimentos, sendo 1 do plano, e ver os 3 no cartão da consulta (P3).
- A grade nunca oferece um horário que conflita (testar com consulta e bloqueio existentes).
- Consulta com `reminder_mode = 'none'` não recebe lembrete na rotina (teste).
- Celular 390px: o diálogo vira tela cheia; a grade quebra em 4 colunas; o rodapé fica fixo.

---

## P2. Compromissos (bloqueios com nome, repetição e dia inteiro)

**Hoje:** `schedule_blocks` com unidade, profissional (null = unidade toda), início, fim e motivo; `block-form.tsx` com data, das/até e motivo.


### O que fazer

1. Colunas novas em `schedule_blocks`:
   - `title text not null default 'Bloqueio' check (length <= 120)`;
   - `notes text check (length <= 1000)`;
   - `all_day boolean not null default false`;
   - `series_id uuid null`;
   - `kind text not null default 'block' check in ('block','event')`. `block` impede marcar consulta; `event` é só um lembrete na agenda e não impede. Default `block` para não mudar o comportamento atual.
2. Aba **Compromisso** no diálogo da P1:
   - nome (obrigatório, com sugestões em chips: "Almoço", "Reunião", "Curso", "Feriado", "Manutenção");
   - "Para": `SegmentedControl` **Profissional | Clínica toda**. Com Profissional, aparece o seletor de profissional. "Clínica toda" = `professional_id null` na unidade selecionada;
   - "Bloqueia a agenda?" (`kind`): ligado por padrão;
   - data;
   - **Dia inteiro**: esconde a grade de horário;
   - horário de início e fim. Usar a mesma grade de chips; o primeiro clique escolhe o início e o segundo o fim, e a faixa entre os dois fica destacada;
   - **Repetição**: Não se repete · Todo dia útil (seg–sex) · Toda semana · A cada 15 dias · Todo mês, com "Até" (data) ou "Quantas vezes" (máx. 52);
   - observações.
3. Criar a série como as consultas em série: cada ocorrência é uma linha com o mesmo `series_id`. Se uma ocorrência que bloqueia cair em cima de consulta existente, **não** criar essa ocorrência; listar as datas puladas no fim ("3 datas não foram criadas porque já têm consulta: …").
4. Editar ou excluir uma ocorrência de série pergunta: "Só este" · "Este e os próximos" · "Todos".
5. Na agenda:
   - **bloqueio** = faixa hachurada cinza com o nome;
   - **evento** = cartão fino com borda tracejada em `tint-lilac` e o nome;
   - **dia inteiro** = faixa no topo da coluna, abaixo do cabeçalho do profissional;
   - "Clínica toda" aparece em todas as colunas.
6. O botão "Bloquear" da barra da agenda vira **"+ Novo"** com menu: Nova consulta · Novo compromisso · Alerta de retorno (o alerta abre o diálogo de retorno que já existe).
7. O agendamento online (Etapa 24) e a "vaga liberada" passam a ignorar `kind = 'event'` e respeitar `all_day`.

### Aceite

- Almoço de seg a sex, 12:00–13:00, por 4 semanas, para a Dra. Ana: 20 ocorrências; a grade da P1 não oferece esses horários.
- Feriado de dia inteiro para a clínica toda: nenhum horário livre naquele dia, inclusive no agendamento online.
- "Este e os próximos" altera só as ocorrências futuras (teste).

---

## P3. Cartão da consulta (popover ao clicar na agenda)

**Referência visual:** artboard `ConsultaCard` no canvas de design (já no visual 2.0). Substitui o conteúdo de `appointment-details.tsx`.

### Estrutura, de cima para baixo

1. **Cabeçalho:**
   - avatar de iniciais em tom pastel, nome do paciente (link para a ficha), idade e celular;
   - etiquetas quando existirem: alerta da anamnese (vermelho, com o item: "Alergia a penicilina"), "Primeira vez" (`tint-sky`), "Indicado por <nome>" (`tint-mint`), "Retorno vencido" (`tint-peach`);
   - botão fechar.
2. **Quatro atalhos** em quadrados iguais com ícone em quadradinho pastel:
   - **Ficha** → ficha do paciente;
   - **WhatsApp** → conversa, com a mensagem de confirmação preenchida se a consulta ainda não foi confirmada;
   - **Orçamentos** → aba de orçamentos da ficha;
   - **Financeiro** → aba financeiro da ficha (esconder para dentista, que não opera o financeiro).
3. **Bloco da data:**
   - "calendário" pequeno com mês e dia, linha com dia, horário e duração, e linha com o ponto da cor do profissional, o profissional e a cadeira;
   - botões **Remarcar** (entra no modo de arrastar/escolher horário) e **Editar** (abre o diálogo da P1 preenchido);
   - abaixo, **Procedimentos** (lista da P1 com dente e faces) e a observação da consulta.
4. **Faixa financeira** (só para quem opera o financeiro):
   - **"Financeiro em dia"** (`--success-soft`, ícone de check) com o contexto: "Plano aprovado · 3 de 6 parcelas pagas" ou "Nenhuma cobrança";
   - **"Pagamento pendente"** (`--destructive-soft`) com o valor vencido e o botão **"Receber"**, que abre a baixa já existente;
   - mesma regra de "vencido" da ficha (R5). Função única `getPatientFinancialStatus(patientId)` reutilizada na ficha (P5).
5. **Marcadores:** chips com os marcadores da consulta e "+ Adicionar" (lista de marcadores da clínica). Hoje já existem marcadores (Etapa 15); só mudar o visual e permitir incluir e remover dali.
6. **Rodapé:**
   - à esquerda, duas linhas pequenas: "Agendado por <nome> em <data> às <hora>" (ou "Agendado online pelo paciente em …") e a linha de situação ("Confirmado pelo WhatsApp em 25/11", "Chegou às 15:12 · na sala de espera", "Aguardando confirmação");
   - à direita, um **seletor de status** com ponto colorido e o nome: Agendado · Confirmado · Na espera · Em atendimento · Atendido · Faltou · Desmarcado (desmarcar continua exigindo motivo).
   - Mostrar **"Atrasado"** como etiqueta calculada (consulta agendada ou confirmada cujo início passou há mais de 10 min sem check-in). Não é status salvo.
7. **Rodapé extra** em texto pequeno: "Mais ações" com Desmarcar, Lista de espera, Imprimir comprovante e Excluir (só gestão).

### Aceite

- Em 1280px o popover tem 440px de largura e abre ao lado do cartão sem cobrir a coluna inteira; em 390px vira folha de baixo para cima.
- O dentista não vê a faixa financeira nem o atalho Financeiro (teste de permissão).
- Trocar o status pelo seletor atualiza a agenda em tempo real (Realtime já usado na sala de espera).

---

## P4. Cadastro completo do paciente

**Hoje:** `patients` tem nome, CPF, nascimento, gênero, telefone, WhatsApp, e-mail, endereço (jsonb), origem (enum curto), observações, responsável (nome e CPF), LGPD, indicação (paciente ou parceiro).

### Banco

1. Colunas novas em `patients`, todas opcionais:
   - `nickname text` ("como prefere ser chamado"), `rg text`, `marital_status text check in ('solteiro','casado','uniao_estavel','divorciado','viuvo')`, `education text check in ('fundamental','medio','superior','pos','nao_informado')`;
   - `occupation text`, `workplace text`, `record_number text` (nº de prontuário; único por clínica quando preenchido; a clínica pode deixar numerar sozinho, sequência por clínica);
   - `phone_country text default '55'`, `landline text`, `no_email boolean default false`;
   - `instagram text`, `facebook text` (só o usuário, sem URL);
   - `preferred_contact text check in ('patient','guardian') default 'patient'` ("entrar em contato pelo celular de");
   - `father_name`, `mother_name` (texto) e `guardian_relationship`, `guardian_phone`, `guardian_birth_date`, `guardian_rg` (o responsável já tem nome e CPF);
   - `photo_path text` (Storage, bucket privado por clínica).
2. Tabela `patient_phones (id, clinic_id, patient_id, label text, number text)` para "outros telefones".
3. **Origem:** trocar o enum curto por tabela `patient_sources (id, clinic_id, name, active, position)` com os padrões criados para cada clínica: Indicação, Instagram, Google, Facebook, Site, Escola, Outdoor, Panfleto, Placa/fachada, Rádio, TV, Revista, Outros. **Sem convênio.**
   - Migrar os valores do enum atual para as linhas novas e manter o enum lido por compatibilidade até o fim da etapa.
   - CRM, relatórios e tokens `--source-*` passam a usar essa tabela. A cor vem de uma paleta fixa pela posição; Instagram e Google mantêm as cores atuais.
   - A gestão edita a lista em Configurações > Pacientes e captação.
4. **"Indicado por"** no cadastro direto (pendência da Etapa 17): busca de paciente ou parceiro, gravando nos campos que já existem.
5. **Validação:**
   - menor de 18 anos exige nome, CPF e telefone do responsável, e `preferred_contact` vira `guardian` por padrão;
   - CPF e telefone validados como hoje;
   - e-mail obrigatório só se `no_email = false` **e** a clínica marcar assim (padrão: opcional).

### Telas

1. **Cadastro rápido** (painel lateral "Novo paciente", também usado pela P1): nome, celular com país, nascimento, gênero, origem (+ indicado por), CPF opcional e e-mail / "não tem e-mail". Botão secundário **"Preencher cadastro completo"** abre a versão completa já com o que foi digitado.
2. **Cadastro completo** em `FormSections`, com navegação por âncoras no topo em pílulas:
   - **Identificação**: foto, nome, apelido, nascimento (mostra idade), gênero, CPF, RG, estado civil, escolaridade, nº de prontuário;
   - **Contato**: celular com país, WhatsApp igual ao celular (marcado por padrão), telefone fixo, outros telefones (lista com "+ Adicionar"), e-mail / não tem e-mail, Instagram, Facebook, "Falar com" (paciente ou responsável);
   - **Endereço**: CEP com busca automática (ViaCEP no servidor), rua, número, complemento, bairro, cidade, estado;
   - **Responsável e família**: aparece aberto e obrigatório para menor, recolhido para adulto; responsável (nome, parentesco, CPF, RG, nascimento, telefone), pai, mãe;
   - **Trabalho**: profissão, local de trabalho;
   - **Como conheceu**: origem e indicado por;
   - **Observações e LGPD**: observações e o consentimento como já é hoje.
   - Rodapé fixo com "Cancelar" e "Salvar".
3. **Histórico de edição:** link "Ver histórico" no rodapé da aba Dados da ficha, abrindo um painel com quem, quando e o que mudou (de → para). Ler do `audit_log` que já existe; se o log não guarda o antes e o depois dos campos do paciente, acrescentar no gatilho.
4. **Aba Dados da ficha** mostra tudo isso agrupado nos mesmos blocos, só leitura, com "Editar dados".

### Aceite

- Cadastrar um menor sem responsável mostra o erro no bloco certo e rola até ele.
- A lista de origens nova aparece no cadastro, no CRM e no filtro de Pacientes; nenhum paciente antigo perde a origem (teste da migração).
- RLS: `patient_phones` e `patient_sources` isolados por clínica.

---

## P5. Ficha do paciente: o que falta

1. **Cabeçalho:**
   - foto do paciente (P4) no lugar das iniciais quando houver;
   - selo **"Financeiro em dia"** ou **"R$ X vencido"** ao lado do nome, com a mesma função da P3 e escondido para o dentista;
   - menu "Mais" com: **Inativar/Reativar** (renomear "Arquivar" para "Inativar" só no texto; mesma regra), **Imprimir dados** (PDF do cadastro no padrão dos PDFs da R9), Exportar dados (LGPD, já existe), **Link do portal**, **Link de agendamento online**, **Link de indicação** (formulário de captação com `?indicado_por=<id>`; o lead entra no CRM com a indicação preenchida).
2. **Notas gerais:** tabela `patient_notes (id, clinic_id, patient_id, body, pinned bool, created_by, created_at)`. Nota é registro: não se edita, só se apaga (autor ou gestão). Cartão "Notas" na visão geral com "+ Nota", fixadas primeiro. Todo membro lê e escreve; nota não é prontuário.
3. **Visão geral:** se ainda não existir como aba, criar a primeira aba **"Resumo"** com cartões: próxima consulta (+ Agendar), alerta de retorno (+ Definir retorno), orçamentos em aberto (+ Ver), anamnese (preenchida em / + Preencher), notas gerais e últimas evoluções.
4. **Exames:** separar de "Arquivos" com uma categoria no arquivo (`category text check in ('exame','foto','documento','outro')`). A aba Exames lista só os exames, com data do exame e tipo (radiografia panorâmica, periapical, tomografia, outro).
5. **Fotos em pastas:** tabela `patient_file_folders (id, clinic_id, patient_id, name)` e coluna `folder_id` nos arquivos. Grade de miniaturas, ordenar por data, seleção múltipla para mover ou baixar, pastas padrão sugeridas ("Inicial", "Durante", "Final"). Comparar antes e depois lado a lado (duas fotos selecionadas → "Comparar").
6. **Recibos:** aba que lista os recibos emitidos do paciente (já gerados no financeiro), com reimprimir.
7. **Agendamentos:** a aba ganha **Exportar** (Excel/CSV com o mesmo gerador dos relatórios) e **Imprimir** (PDF).

---

## P6. Odontograma: dentição mista e sessões

1. **Dentição mista:** a terceira opção no `SegmentedControl` (Permanentes · Decíduos · **Mista** · Histórico). A mista mostra os permanentes e os decíduos (51–85) juntos, na arcada, com os decíduos menores e por dentro. A regra do que aparece por idade não muda (o usuário escolhe).
2. **Sessões por procedimento:**
   - coluna `sessions_planned int default 1` no item do plano;
   - tabela `plan_item_sessions (id, clinic_id, plan_item_id, done_at, appointment_id null, notes, created_by)`;
   - o item mostra "2 de 3 sessões"; marcar uma sessão registra; o item vira realizado quando as sessões chegam ao total (ou manualmente, como hoje);
   - na P1, ao incluir um procedimento do plano, a consulta fica ligada à próxima sessão.
3. **Tela cheia e imprimir:** botão para abrir o odontograma ocupando a tela e "Imprimir" (PDF com o desenho e a tabela de procedimentos: data, dente, procedimento, sessões, situação).

---

## P7. Financeiro do paciente: crédito e mensalidades

1. **Crédito do paciente** (saldo a favor):
   - tabela `patient_credits (id, clinic_id, patient_id, amount_cents, kind in ('entrada','uso','estorno'), receivable_id null, payment_id null, notes, created_by, created_at)`. Movimento é registro, não se edita;
   - saldo = soma; nunca negativo, garantido por função `use_patient_credit` no banco;
   - **entradas**: pagamento a mais na baixa (a baixa pergunta "Guardar R$ X como crédito?") ou lançamento manual da gestão;
   - **uso**: na baixa de uma parcela, aparece "Usar crédito (saldo R$ X)" como forma de pagamento;
   - mostrar o saldo no cabeçalho da aba Financeiro da ficha e no cartão da consulta quando for maior que zero.
2. **Mensalidades** (ortodontia, manutenção):
   - tabela `patient_subscriptions (id, clinic_id, patient_id, description, amount_cents, due_day int 1–28, starts_on, ends_on null, active)`;
   - a rotina diária gera a parcela do mês seguinte (uma por mês, índice único por assinatura e competência), que entra em contas a receber, na régua de cobrança e na cobrança online como qualquer parcela;
   - encerrar não apaga as parcelas já geradas;
   - botão **"+ Mensalidade"** na aba Financeiro da ficha;
   - só quem opera o financeiro.

---

## P8. Agenda: filtro, impressão e alertas de retorno

1. **Filtro de profissionais na coluna lateral:** lista com caixas de marcar, ponto da cor e "Todos"; escolha lembrada no navegador (try/catch no localStorage). Esconde as colunas desmarcadas na visão por profissional.
2. **Imprimir agenda:** botão na barra → PDF do dia (ou da semana) por profissional, com horário, paciente, celular, procedimentos, status e observação; compromissos incluídos. Opção "esconder telefones".
3. **Alertas de retorno na lateral:** abaixo da sala de espera, os próximos retornos por data (os 5 primeiros, com "Ver todos" para `/agenda/retornos`).
4. **Contador por coluna:** no cabeçalho de cada profissional, além da ocupação, "8 pacientes".

---

## P9. Barra superior: notificações, ajuda e novidades

1. **Central de notificações** (sino com contador no topo do menu lateral, ao lado da busca):
   - tabela `notifications (id, clinic_id, user_id null = todos com o papel, roles text[], kind, title, body, link, read_at, created_at)`;
   - geradas por gatilhos ou rotinas que já existem: agendamento online novo, pedido de remarcação pelo portal, documento assinado, cobrança online paga, ordem de prótese que voltou do laboratório, estoque abaixo do mínimo, lead novo do formulário;
   - lista em painel com "Marcar todas como lidas", em tempo real (Realtime).
2. **Busca ⌘K** já encontra páginas; acrescentar **funções e configurações** ("mensagem de confirmação", "cadeiras", "nota fiscal", "comissão" levam à tela certa) com sinônimos sem acento.
3. **Ajuda e novidades:**
   - item "Ajuda" no rodapé do menu com links para artigos (por enquanto uma página `/ajuda` com perguntas frequentes em Markdown no repositório);
   - **"Novidades"**: lista em Markdown em `content/novidades/*.md` com data e versão; mostrar um ponto no menu quando houver novidade não vista (data gravada no perfil do usuário).

---

## P10. Avaliações no Google (deixar por último)

- Relatório "Avaliações no Google": nota média, total, avaliações novas no período e as últimas avaliações, além de um link "Pedir avaliação" que gera mensagem de WhatsApp com o link de avaliação da clínica (configurado pela gestão em Configurações > Clínica).
- **Primeira versão sem API:** só o link de avaliação e o envio da mensagem pós-consulta (modelo novo `review_request`, opcional, X horas depois de "Atendido").
- A leitura das avaliações pela API do Google Business Profile fica como pendência (exige aprovação do Google). Anotar no PROGRESS.

---

## Ordem e tamanho

| Etapa | Depende de | Migration | Tamanho |
| --- | --- | --- | --- |
| P1 Nova consulta | — | sim | grande |
| P2 Compromissos | P1 (abas) | sim | médio |
| P3 Cartão da consulta | P1 (procedimentos) | não | médio |
| P4 Cadastro completo | — | sim | grande |
| P5 Ficha | P3 (status financeiro), P4 | sim | grande |
| P6 Odontograma | P1 | sim | médio |
| P7 Crédito e mensalidades | — | sim | médio |
| P8 Agenda extras | P2 | não | pequeno |
| P9 Notificações e ajuda | — | sim | médio |
| P10 Avaliações Google | — | sim | pequeno |

Ao terminar a P10, rodar a auditoria da R10 (`AUDIT=... SCREENS=r10 npx playwright test e2e/screens.spec.ts`) nas telas mexidas.
