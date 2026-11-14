# Progresso

| Etapa | Status | Observações |
| --- | --- | --- |
| 1. Fundação | Concluída (13/11/2026) | Layout, Supabase (clientes), testes. Sem migrations. |
| 2. Multi-tenant e login | Concluída (14/11/2026) | Banco com RLS, cadastro, login, senha, convites, troca de clínica/unidade. Teste de isolamento passando. |
| 3. Configurações | Não iniciada | |
| 4. Pacientes | Não iniciada | |
| 5. Agenda | Não iniciada | |
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
- **Deploy:** GitHub (`felipelauckk/saas-odonto`) + Vercel.

## Pendências da Etapa 1

- ~~Preencher o `.env.local` e rodar `npx supabase link`~~ — feito em 13/11/2026 (projeto `ofgmapiholeqbgkjgoch`). Chaves no formato novo (`sb_publishable_...` / `sb_secret_...`).
- Trocar a chave secreta (`sb_secret_...`) antes de entrar dado real: ela foi compartilhada por chat durante a configuração.
- `database.types.ts` é um placeholder até existir a primeira migration.

## Pendências da Etapa 2

- **Supabase → Authentication → URL Configuration:** colocar o endereço da Vercel como Site URL e adicionar `https://<endereço>.vercel.app/**` e `http://localhost:3000/**` em Redirect URLs. Sem isso, os links dos e-mails apontam para o lugar errado.
- **Envio de e-mail para produção:** o envio padrão do Supabase tem limite baixo (poucos e-mails por hora) e serve só para desenvolvimento. Configurar um SMTP próprio (Resend, SES etc.) antes de abrir para clientes.
- **Modelos de e-mail em português:** os e-mails de confirmação, convite e nova senha ainda saem com o texto padrão do Supabase, em inglês.
- **Unidades permitidas por membro** (`unit_ids`): o banco já suporta, mas a tela para editar entra na Etapa 3, junto com o cadastro de unidades.
- **2 fatores para owners** (opcional, previsto na especificação): não implementado nesta etapa.
