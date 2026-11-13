# Odonto SaaS

Sistema de gestão para clínicas odontológicas. Especificação em [docs/SPEC.md](docs/SPEC.md), andamento em [docs/PROGRESS.md](docs/PROGRESS.md).

## Requisitos

- Node.js 24 ou mais novo
- Um projeto no Supabase (nuvem)

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencha com as chaves do Supabase
npm run dev                  # http://localhost:3000
```

Sem o `.env.local` o app abre normalmente (layout e páginas vazias); o Supabase só passa a ser usado a partir da Etapa 2.

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run lint` | ESLint |
| `npm run typecheck` | Checagem de tipos (TypeScript strict) |
| `npm test` | Testes de regra de negócio (Vitest) |
| `npm run test:e2e` | Testes de fluxo no navegador (Playwright) |
| `npm run db:push` | Aplica as migrations de `supabase/migrations` no projeto vinculado |
| `npm run db:types` | Gera os tipos do banco em `src/lib/supabase/database.types.ts` |

Para usar `db:push` e `db:types`, vincule o projeto uma vez:

```bash
npx supabase login
npx supabase link --project-ref <ref-do-projeto>
```

## Estrutura

```
src/app              rotas (o grupo (app) tem o layout com menu lateral)
src/components       UI: ui/ (shadcn), layout/, feedback/
src/features         lógica por módulo
src/lib              supabase/, env, formatação
supabase/migrations  migrations SQL (única forma de alterar o banco)
e2e                  testes Playwright
```
