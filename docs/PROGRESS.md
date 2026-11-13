# Progresso

| Etapa | Status | Observações |
| --- | --- | --- |
| 1. Fundação | Concluída (13/11/2026) | Layout, Supabase (clientes), testes. Sem migrations. |
| 2. Multi-tenant e login | Não iniciada | |
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

## Pendências da Etapa 1

- Preencher o `.env.local` com as chaves do projeto Supabase e rodar `npx supabase link` (necessário antes da Etapa 2).
- `database.types.ts` é um placeholder até existir a primeira migration.
