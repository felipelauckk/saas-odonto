# Progresso

| Etapa | Status | Observações |
| --- | --- | --- |
| 1. Fundação | Concluída (13/11/2026) | Layout, Supabase (clientes), testes. Sem migrations. |
| 2. Multi-tenant e login | Concluída (14/11/2026) | Banco com RLS, cadastro, login, senha, convites, troca de clínica/unidade. Teste de isolamento passando. |
| 3. Configurações | Concluída (14/11/2026) | Clínica e logo, unidades, cadeiras, profissionais com horários, procedimentos, formas de pagamento, unidades por membro. Dados iniciais em toda clínica nova. |
| 4. Pacientes | Concluída (14/11/2026) | Lista com busca e filtros, cadastro com CPF/CEP/LGPD/responsável legal, ficha com abas (só Dados ativa), arquivar e reativar. |
| 5. Agenda | Concluída (14/11/2026) | Dia e semana, por profissional ou cadeira, marcar clicando, arrastar para remarcar, status com um clique, bloqueios, conflitos no banco, tempo real, relatório de faltas, aba Agendamentos. Lembrete por WhatsApp fica na Etapa 9. |
| 6. Prontuário | Não iniciada | |
| 7. Orçamentos | Não iniciada | |
| 8. Financeiro | Não iniciada | |
| 9. WhatsApp | Não iniciada | |
| 10. Assinatura do SaaS | Não iniciada | |
| 11. Painel inicial e acabamento | Não iniciada | |

## Decisões técnicas

- **Next.js 16.4 com `cacheComponents` desligado.** O template novo liga essa opção, que guarda dados em cache no servidor. Quase todas as telas dependem da sessão e de dados por clínica (RLS), e um cache mal configurado poderia mostrar dados de uma clínica para outra. Usamos o modelo clássico (sem cache automático). Se for religar no futuro, revisar todo `use cache`.
- **Middleware se chama `proxy` no Next 16** (`src/proxy.ts`). Por enquanto só renova a sessão do Supabase; a proteção de rotas entra na Etapa 2. Sem `.env.local` ele não faz nada, para o app abrir mesmo sem Supabase configurado.
- **shadcn/ui com estilo `base-nova`** (componentes sobre Base UI, não Radix) e o pacote `cn` (do próprio shadcn) no lugar de `clsx` + `tailwind-merge`. Botões usam `render={...}` em vez de `asChild`.
- **Cor de destaque:** azul-petróleo `oklch(0.47 0.075 218)`, definida em `src/app/globals.css` (`--primary`). Fonte Inter.
- **44px no toque:** botões, campos e links do menu ganham altura mínima de 44px em telas de toque (`pointer-coarse:`). No desktop ficam em 36px, mais compactos.
- **Variáveis de ambiente validadas com Zod:** `src/lib/env.ts` (públicas) e `src/lib/env.server.ts` (secretas, com `server-only`). O cliente admin (`src/lib/supabase/admin.ts`) também importa `server-only`, então o build falha se alguém usá-lo num componente client.
- **Supabase na nuvem para desenvolvimento** (sem Docker). CLI do Supabase instalada como dependência de desenvolvimento (`npx supabase`).
- **`@types/node` 24** (o template trazia o 20, incompatível com o Vitest 5). `engines.node >= 24`.
- **Testes:** Vitest roda com `TZ=UTC`, para provar que a formatação de datas usa `America/Sao_Paulo` independentemente da máquina. Playwright roda em dois perfis (desktop e celular) na porta 3100.

- **Clínica ativa no banco** (`profiles.active_clinic_id`), não em cookie. `current_clinic_id()` só aceita a clínica se o usuário for membro ativo; se não, cai na primeira clínica em que ele é membro. A troca é feita pela função `set_active_clinic()`, que confere o vínculo; o app não pode gravar essa coluna direto.
- **Unidade ativa em cookie** (`active_unit_id`): é só filtro de tela. A permissão por unidade (`clinic_members.unit_ids`, vazio = todas) é conferida pela função `can_access_unit()` na RLS de `units`, e será usada nas políticas da agenda e do caixa.
- **`has_role()` aceita vários papéis:** `has_role('owner', 'manager')`.
- **Cadastro pelo gatilho `handle_new_user`:** o `signUp` manda `clinic_name` nos metadados e o gatilho cria clínica (teste de 14 dias), "Unidade principal" e o vínculo de owner na mesma transação. Usuário convidado não manda `clinic_name` e só ganha o perfil.
- **Privilégios por coluna:** o app não consegue alterar os campos de assinatura da clínica (`plan_id`, `subscription_status`, `trial_ends_at`, `asaas_*`), nem `clinic_id`/`user_id` dos membros. Isso é coberto pelo teste de isolamento.
- **Clínica nunca fica sem owner ativo** (gatilho `ensure_clinic_has_owner`). Só owner cria ou altera outro owner. Ninguém altera o próprio acesso pela tela.
- **Convites:** e-mail novo → `inviteUserByEmail` (service role, só no servidor) + vínculo gravado com o cliente do usuário, então a RLS confere a permissão. Quem já tem conta só ganha o vínculo e vê a clínica no seletor.
- **Links de e-mail** (confirmação, convite, nova senha) caem em `/auth/confirmar`, que aceita os três formatos do Supabase (`token_hash`, `code` e `#access_token`).
- **Confirmação de e-mail ligada** no cadastro. `plans` começa vazia; clínicas em teste ficam com `plan_id` nulo até a Etapa 10.
- **Testes de banco no Vitest** rodam contra o Supabase remoto (carregam o `.env.local`), criam os próprios usuários e apagam tudo no fim. Os testes Playwright fazem o mesmo.
- **Configurações: leitura para todos, escrita só owner/manager.** Dentista e recepção leem profissionais, cadeiras, procedimentos e formas de pagamento (precisam na agenda e nos orçamentos). Nada é apagado, só desativado (`active`), porque agenda e financeiro vão apontar para esses registros. Exceção: linhas de horário, substituídas ao salvar a grade.
- **FKs compostas `(id, clinic_id)`** em cadeiras, horários e no vínculo profissional→membro: o banco impede ligar registros de clínicas diferentes, mesmo que alguém burle o app.
- **Horários sem sobreposição no banco** (`exclude using gist` com o tipo `timerange`): o mesmo profissional não atende em dois lugares ao mesmo tempo. A grade é salva pela função `replace_professional_schedule()` numa transação só, com a RLS de quem chama.
- **Dados iniciais** (`seed_clinic_defaults`): 32 procedimentos com preço R$ 0,00 (a clínica define os seus; a tela avisa "sem preço"), 5 formas de pagamento sem taxa e o modelo padrão de anamnese. Rodou também para as clínicas que já existiam.
- **Logo** no bucket privado `clinic`, caminho `{clinic_id}/logo/...`, exibido por URL assinada. PNG/JPG/WebP até 1 MB (SVG recusado por segurança). As políticas do bucket cobrem só a pasta `logo`; arquivos clínicos ganham regras próprias na Etapa 6.
- **Fora da tela nesta etapa (decisão de 14/11/2026):** comissão do profissional (coluna existe, Fase 2), editor do modelo de anamnese (Etapa 6) e modelos de mensagem (Etapa 9).
- **Limites do plano** (`max_units`, `max_professionals`) ainda não são aplicados: entram na Etapa 10, com os planos.
- **Pacientes: todos os papéis leem, cadastram, editam e arquivam** (decisão de 14/11/2026). O banco não tem permissão de DELETE em `patients`: só arquivamento (`archived_at`).
- **CPF único por clínica** (índice parcial). O mesmo CPF pode existir em clínicas diferentes. Ao repetir, a tela mostra o paciente existente com link para a ficha.
- **Busca** pela função `search_patients()` (SECURITY INVOKER, respeita a RLS): nome sem acento e em qualquer parte (coluna gerada `search_name` + índice trigram), CPF pelo começo e telefone/WhatsApp por qualquer trecho de dígitos (a partir de 3). Devolve o total para a paginação (25 por página). Filtros ficam na URL.
- **Responsável legal** (`guardian_name`, `guardian_cpf`): incluído a pedido (14/11/2026). Os campos aparecem e o nome passa a ser obrigatório quando a data de nascimento indica menor de 18 anos.
- **Consentimento LGPD** registrado uma única vez, com data e quem registrou (`consent_lgpd_at`, `consent_lgpd_by`).
- **CEP pelo ViaCEP**, chamado do navegador: só o CEP sai, nenhum dado do paciente. Se o serviço falhar, a tela pede para preencher à mão. Nos testes o ViaCEP é simulado.
- **Datas sem fuso** (nascimento) são tratadas como texto AAAA-MM-DD; "hoje" e a idade usam o dia de São Paulo (`src/lib/dates.ts`).
- **Abas da ficha:** cada aba futura ganha a própria rota na sua etapa; até lá, `/pacientes/[id]/[aba]` mostra "em breve".
- **Agenda: quem vê o quê** (decidido em 14/11/2026, com aval para seguir sem aprovação prévia): owner/manager veem tudo; recepção, as unidades permitidas (`unit_ids`); dentista, só a própria agenda — os profissionais ligados ao seu usuário (`current_professional_ids()`). Dentista sem profissional ligado vê um aviso para o gestor configurar. Regra única na função `can_access_agenda()`, usada nas políticas.
- **Conflitos no banco** (`exclude using gist` com `tstzrange`): mesmo profissional e mesma cadeira não se sobrepõem. Consultas `canceled` e `no_show` liberam o horário. Encostar (fim = início) é permitido.
- **Bloqueios** (`schedule_blocks`): da unidade toda (`professional_id` nulo) ou de um profissional. Gatilho recusa consulta em horário bloqueado com SQLSTATE próprio `OB001`. Dentista só bloqueia a própria agenda.
- **Fora do expediente é permitido** (encaixe); a grade só mostra apagado. O expediente vem de `professional_schedules`.
- **Consulta não é apagada**, só cancelada (sem permissão de DELETE). `confirmed_at` é preenchido por gatilho ao confirmar.
- **Horários**: guardados em `timestamptz`; a tela converte para São Paulo com `src/lib/timezone.ts` (deslocamento calculado pelo Intl, funciona se o horário de verão voltar). Consulta que atravessa a meia-noite aparece nos dois dias.
- **Arrastar para remarcar** só com mouse/caneta; no toque atrapalharia a rolagem, então o celular usa "Editar ou remarcar". Encaixe de 15 min. A posição muda na hora (otimista) e volta se o banco recusar.
- **Tempo real**: `appointments` e `schedule_blocks` na publicação `supabase_realtime`. O canal só é aberto depois de carregar a sessão e passar o token (`realtime.setAuth`); sem isso a RLS escondia todos os eventos. Ao receber um evento, a tela recarrega os dados (`router.refresh`).
- **Cadastro rápido de paciente** (nome e telefone) direto na agenda; o resto se completa na ficha.
- **Taxa de faltas** = faltas ÷ consultas já passadas no período, sem as canceladas.
- **Deploy:** GitHub (`felipelauckk/saas-odonto`) + Vercel.

## Pendências da Etapa 1

- ~~Preencher o `.env.local` e rodar `npx supabase link`~~ — feito em 13/11/2026 (projeto `ofgmapiholeqbgkjgoch`). Chaves no formato novo (`sb_publishable_...` / `sb_secret_...`).
- Trocar a chave secreta (`sb_secret_...`) antes de entrar dado real: ela foi compartilhada por chat durante a configuração.
- `database.types.ts` é um placeholder até existir a primeira migration.

## Pendências da Etapa 2

- **Adiado até haver domínio definitivo** (decisão de 14/11/2026: por enquanto o sistema é só para testes do Felipe). Conta de teste criada direto no banco, já confirmada: `clinicateste@example.com`, clínica "Clínica Teste". Enquanto isso, cadastro público e convites (que dependem de e-mail) não funcionam de ponta a ponta no endereço da Vercel.
- **Supabase → Authentication → URL Configuration:** colocar o endereço da Vercel como Site URL e adicionar `https://<endereço>.vercel.app/**` e `http://localhost:3000/**` em Redirect URLs. Sem isso, os links dos e-mails apontam para o lugar errado.
- **Envio de e-mail para produção:** o envio padrão do Supabase tem limite baixo (poucos e-mails por hora) e serve só para desenvolvimento. Configurar um SMTP próprio (Resend, SES etc.) antes de abrir para clientes.
- **Modelos de e-mail em português:** os e-mails de confirmação, convite e nova senha ainda saem com o texto padrão do Supabase, em inglês.
- **Unidades permitidas por membro** (`unit_ids`): o banco já suporta, mas a tela para editar entra na Etapa 3, junto com o cadastro de unidades.
- **2 fatores para owners** (opcional, previsto na especificação): não implementado nesta etapa.
