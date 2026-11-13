# CLAUDE.md — Sistema odontológico SaaS

Este arquivo é lido em toda sessão. A especificação completa está em `docs/SPEC.md`: ela é a fonte da verdade.

## Produto
SaaS de gestão para clínicas odontológicas, cobrado por mensalidade. Várias clínicas no mesmo sistema, isoladas por `clinic_id` + RLS. Só atendimento particular (sem convênios/TISS). Cada clínica tem uma ou mais unidades.

## Stack
- Next.js (App Router) + TypeScript (strict)
- Tailwind CSS + shadcn/ui
- Supabase: Postgres, Auth, Storage, Realtime, Edge Functions
- Zod para validação; Vitest + Playwright para testes
- Asaas para cobrança recorrente; WhatsApp via camada `messaging` com provedor plugável
- Deploy: Vercel + Supabase

## Como trabalhar
1. Uma etapa por vez, na ordem de `docs/SPEC.md` > "Ordem de implementação". Não avance sem a etapa atual funcionar.
2. Antes de cada etapa: plano curto (arquivos, migrations, testes) e espere aprovação.
3. Ao terminar: o que foi feito, como testar manualmente, o que ficou pendente. Atualize `docs/PROGRESS.md`.
4. Rode `npm run lint`, `npm run typecheck` e os testes antes de dizer que terminou.
5. Não invente funcionalidades fora do escopo. Dúvida → pergunte.
6. Commits pequenos, um por etapa ou sub-etapa, mensagem em português.

## Regras obrigatórias
- Toda mudança de banco é migration SQL em `supabase/migrations/`. Nunca altere o banco pelo painel.
- Toda tabela de dados da clínica tem `clinic_id`, `created_at`, `updated_at` e RLS ativa. Tabela sem RLS é bug.
- Use as funções `current_clinic_id()` e `has_role(role)` nas políticas. Nunca confie em filtro só no front-end.
- `SUPABASE_SERVICE_ROLE_KEY` só no servidor. Nunca em componente client.
- Dinheiro em centavos (integer) no banco; exibir em R$ (`Intl.NumberFormat('pt-BR')`).
- Datas no fuso `America/Sao_Paulo`.
- Interface e mensagens em português do Brasil; código, tabelas e variáveis em inglês.
- Paciente nunca é apagado, só arquivado (`archived_at`). Evolução clínica não pode ser apagada.
- Arquivos clínicos em bucket privado `clinic/{clinic_id}/...`, acesso por URL assinada.

## Padrões de código
- Server Components por padrão; Server Actions para mutações, validadas com Zod.
- Estrutura: `src/app` (rotas), `src/components` (UI), `src/features/<modulo>` (lógica por módulo), `src/lib` (supabase, utils), `supabase/migrations`.
- Componentes pequenos, sem lógica de negócio na UI.
- Sem `any`. Tipos do banco gerados com `supabase gen types`.

## Visual
- Limpo e profissional, estilo ferramentas SaaS modernas (Linear, Notion). Muito espaço em branco, uma cor de destaque, tipografia Inter.
- Menu lateral fixo; seletor de unidade no topo só quando houver mais de uma.
- Estados vazios, carregamento e erro em toda tela. Botões e campos com no mínimo 44px de altura no toque.
- Nada de gradientes chamativos ou emojis na interface.
