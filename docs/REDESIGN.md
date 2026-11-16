# Plano de redesign — Arcada (clínico editorial)

Este documento define o novo visual do sistema e a ordem de implementação. Ele não muda nenhuma regra de negócio, permissão ou banco: é só interface.

**Quando executar:** depois da Fase 2 (`docs/SPEC-FASE2.md`), para redesenhar as telas antigas e as novas de uma vez. A etapa R1 (tokens e componentes) pode ser feita antes, entre duas etapas da Fase 2, para que as telas novas já nasçam no visual novo.

As referências visuais estão em `docs/design/`: identidade e componentes (`Main.dc.html`), login, painel, agenda, pacientes, ficha do paciente com odontograma, orçamento, financeiro, CRC, CRM, relatórios, configurações e, no formato celular, o agendamento online e a assinatura de documentos. Os arquivos `.dc.html` usam um formato de protótipo. Leia-os como referência de layout, espaçamento, cores e hierarquia, **sem copiar o código**: a implementação usa os componentes do projeto (shadcn/ui + Tailwind). Os SVGs do odontograma (silhuetas dos dentes e o círculo de 5 faces) podem ser reaproveitados como estão.

## Direção: clínico editorial

Referências estudadas e o que foi tirado de cada uma:

| Referência | O que adotamos |
| --- | --- |
| Mercury (banco) | Tipografia editorial e cor contida: calma transmite confiança |
| Stripe | Tabela como protagonista, números tabulares, mini-gráficos dentro dos indicadores |
| Jane (agenda clínica) | Profissionais em colunas, blocos proporcionais à duração, faltas hachuradas, barra de ferramentas enxuta |
| Attio | Resumo e sugestão de IA como componente da tela, não chat flutuante |
| Painéis de saúde (DrChrono, SimplePractice) | Cor por urgência, não por categoria; automação sempre visível e interrompível |
| Linear e Vercel | Hierarquia por peso e tamanho do texto; cor reservada a estados |

Princípios:

1. Calma transmite confiança: fundo papel, muito respiro e uma cor de marca dominante.
2. Cor só onde há urgência. Vermelho e âmbar indicam algo parado, vencido ou esperando, nunca decoração.
3. A tabela é a verdade e o gráfico é o resumo: um gráfico por pergunta, com a conclusão escrita embaixo.
4. A IA aparece dentro do trabalho (resumo do dia, mensagem sugerida, vaga para oferecer), nunca num chat solto.
5. Toda tela tem estado vazio, carregando e erro desenhados.

## Identidade

- **Nome provisório:** Arcada. Antes de lançar, verificar registro no INPI e domínio. Centralizar nome e símbolo em `src/lib/brand.ts`.
- **Símbolo:** quadrado arredondado com um arco (a arcada) e um ponto verde-água. Versão clara (fundo branco, arco petróleo) no menu escuro; versão escura nos demais fundos. SVG em `docs/design/Main.dc.html`. Gerar `public/logo.svg`, favicon e ícones PWA.
- **Menu lateral escuro em petróleo profundo** é a assinatura visual do produto.

## Tokens

Substituir as variáveis em `src/app/globals.css` (tema claro), mantendo a estrutura do shadcn e acrescentando os tokens de status e de marca.

| Token | Valor | Uso |
| --- | --- | --- |
| `--background` | `#F7F6F3` | Fundo "papel" da aplicação |
| `--card` / `--popover` | `#FFFFFF` | Cartões, painéis, menus |
| `--foreground` | `#14181F` | Texto principal ("tinta") |
| `--muted-foreground` | `#4A515C` | Texto secundário e legendas (contraste acima de 7:1) |
| `--border` | `#E8E6E1` | Bordas de cartão |
| `--border-soft` | `#F0EEEA` | Divisórias internas, fundo neutro de badges |
| `--input` | `#DAD7D0` | Borda de campos e botões secundários |
| `--primary` | `#17707F` | Botão principal, links, foco, item selecionado |
| `--primary-foreground` | `#FFFFFF` | Texto sobre o primário |
| `--brand-deep` | `#0C3640` | Menu lateral, destaques escuros (faixa de resumo, fila ativa) |
| `--brand-highlight` | `#3FB8A8` | Verde-água: contadores no menu escuro, ponto do símbolo, botão sobre fundo escuro |
| `--accent` | `#E3F0F1` | Fundo de item ativo, botão suave, seleção |
| `--accent-foreground` | `#0C3640` | Texto sobre o accent |
| `--ring` | `#17707F` | Anel de foco de 2px |
| `--success` / `--success-soft` | `#157A4C` / `#E5F4EC` | Confirmado, pago, melhora |
| `--warning` / `--warning-soft` | `#9A5B0A` / `#FBF0DD` | Esperando, não confirmado, atenção |
| `--destructive` / `--destructive-soft` | `#B3261E` / `#FBE9E7` | Faltou, vencido, alerta clínico, piora |

- **Cores por profissional** (agenda), em pares forte/suave: petróleo `#17707F`/`#E3F0F1`, violeta `#5B49A8`/`#EFECF9`, âmbar `#A3560F`/`#FBF0E3`, verde `#2E7D4F`/`#EAF5EE`, rosa `#B03A6C`/`#FBEEF3`, azul `#2F5FB3`/`#ECF2FB`. O profissional escolhe uma delas, não uma cor livre.
- **Odontograma:** cárie `#D92D20`, restaurado `#17707F`, planejado `#F2A93B`; coroa (fundo `#FBF0E3`, contorno `#A3560F`); implante (fundo `#EFECF9`, contorno `#5B49A8`, roscas); canal (fundo `#F0EEEA`, linha na raiz `#344054`); ausente (contorno tracejado, "×", 50% de opacidade).
- **Tipografia:**
  - **Montserrat** (Google Fonts, variável) em toda a interface, por decisão do produto (substitui Instrument Serif + Inter).
  - **Black (900)** para títulos de página, saudação do painel e nome do paciente: 32px no celular e 38px no desktop, `line-height: 1.05`, `letter-spacing: -0.025em` (utilitário `type-display`). Títulos menores em Black 20px (`type-title`).
  - **Pesos mais finos no resto:** seção 16/600 (`type-section`), texto 14/400, secundário 13/400, botões 14/500, rótulos 11/600 em caixa alta com `letter-spacing: 0.07em` (`type-label`), indicadores 30/600 com `letter-spacing: -0.025em` e `font-variant-numeric: tabular-nums` (`type-kpi`).
  - Os utilitários usam o prefixo `type-` (não `text-`) para não serem descartados pelo `cn` quando combinados com uma cor de texto.
- **Raios:** cartões 16px, controles 10px, badges e contadores 999px, avatar de paciente 22px (quadrado arredondado, não círculo).
- **Espaçamento:** base 4px. Página com padding 28–40px no desktop e 16px no celular; 20px entre cartões; 18–24px dentro do cartão.
- **Sombras:** só em menus, popovers e diálogos. Cartões usam borda de 1px, sem sombra. Segmented control ativo com sombra mínima `0 1px 2px rgba(20,24,31,.08)`.
- **Ícones:** Lucide, traço 1.75, 18px no menu e 16px em botões. Nada de emoji.

## Componentes

Ajustar ou criar em `src/components/ui` e `src/components/app`:

- **Botões:** primário (petróleo), secundário (branco com borda `--input`), suave (accent), sobre-escuro (verde-água com texto petróleo profundo), perigo, fantasma. Altura 40–42px.
- **StatusBadge:** pílula com ponto + texto. Um mapa único de status (consulta, recebível, orçamento) para as cores, usado em todas as telas.
- **KpiCard em faixa:** os indicadores ficam numa única faixa com divisórias verticais (não 4 cartões soltos). Cada um tem rótulo, variação colorida, número grande, sparkline de 7 pontos e uma linha de contexto.
- **Barra de pressão:** traço vertical de 4px à esquerda de itens de fila, na cor da urgência (vermelho acima de 20 dias, âmbar acima de 7, cinza abaixo).
- **Sugestão da IA:** ícone de brilho em quadrado suave + título curto + uma frase + ação. Na versão de destaque usa o fundo petróleo profundo (faixa do painel, vaga na agenda). O texto sugerido é sempre editável antes de enviar.
- **Tabela/lista:** linhas de 52–64px, divisória `--border-soft`, rótulos em caixa alta, números à direita e tabulares, rolagem horizontal dentro do cartão no celular.
- **Segmented control:** trilho `#ECEAE5`, item ativo branco.
- **Abas:** sublinhado de 2px petróleo no ativo; rolagem horizontal no celular.
- **Campos:** rótulo acima, ajuda e erro abaixo; foco com borda petróleo de 2px.
- **Estados vazios:** ícone em traço, uma frase e o botão da próxima ação. Carregando com skeletons no formato do conteúdo.

## Estrutura do app (shell)

- **Menu lateral de 248px em `--brand-deep`**: símbolo + "Arcada" em Montserrat Black; seletor de clínica/unidade (mostra "Todas as unidades" ou o nome da unidade); botão de busca com ⌘K; navegação agrupada em **Clínica** (Painel, Agenda, Pacientes), **Crescimento** (CRC com contador, CRM) e **Gestão** (Orçamentos, Financeiro, Relatórios, Configurações); usuário com CRO no rodapé. Item ativo com fundo branco a 12%. No celular vira gaveta.
- **Busca global ⌘K / Ctrl+K:** pacientes por nome, CPF ou telefone, e ações rápidas.
- **Cabeçalho da página:** título em Montserrat Black à esquerda, ações à direita. Sem barra de topo.

## Telas

| Etapa | Tela | Referência | O que muda |
| --- | --- | --- | --- |
| R1 | Tokens e componentes | `Main.dc.html` | Variáveis, fontes, botões, campos, StatusBadge, KpiCard, barra de pressão, sugestão da IA |
| R2 | Shell, login e cadastro | `Login.dc.html` | Menu escuro agrupado, seletor, ⌘K; login em duas colunas (formulário + painel petróleo com o arco do símbolo) |
| R3 | Painel | `Painel.dc.html` | Saudação em Montserrat Black; faixa de resumo do dia com ações; faixa de 4 indicadores com sparklines; gráfico de faturamento acumulado contra o ritmo da meta, com projeção; linha do tempo de hoje com marcador "agora"; funil do primeiro contato ao fechamento com a frase da maior perda; lista "Para recuperar" com barras de pressão |
| R4 | Agenda | `Agenda.dc.html` | Data como título; legenda de estados; colunas por profissional com ocupação; o estado da consulta muda o cartão (confirmada: fundo suave e borda; não confirmada: borda tracejada âmbar; em atendimento: cor cheia; faltou: hachurado e riscado; concluída: cinza); linha vermelha do horário atual; mini calendário colorido pela ocupação; sala de espera com tempo; vaga liberada com pacientes da lista de espera |
| R5 | Ficha do paciente | `Paciente.dc.html` | Cabeçalho com avatar e nome em Montserrat Black; faixa de resumo com alerta clínico em vermelho sempre visível, próxima consulta, saldo e última visita; odontograma anatômico (silhueta por tipo de dente, raízes para cima na arcada superior, círculo de 5 faces); painel do dente selecionado com histórico; plano de tratamento com checklist |
| R6 | Listas e gestão | `Pacientes.dc.html`, `Financeiro.dc.html`, `Relatorios.dc.html`, `Configuracoes.dc.html` | Pacientes com busca grande, filtros em pílulas com contagem e situação por paciente; financeiro com abas, faixa de resultado do mês, entradas e saídas de 6 meses com o resultado escrito, caixa do dia e vencimentos a receber e a pagar; relatórios com lista agrupada, pergunta em linguagem natural, barras por profissional e conclusão escrita; configurações com menu de seções, equipe e permissões, plano e integrações |
| R7 | Orçamento, formulários e diálogos | `Orcamento.dc.html` | Orçamento em três colunas: catálogo com busca e categorias, plano proposto por fases com dentes, aviso da IA sobre o que o odontograma tem e o orçamento não, e resumo escuro com total e formas de pagamento. Nova consulta, novo paciente e baixa: diálogo ou painel lateral, nunca página inteira |
| R8 | CRC, CRM e telas da Fase 2 | `CRC.dc.html`, `CRM.dc.html` | Três colunas de trabalho: filas (fila ativa em petróleo profundo), lista com barra de pressão e dias parado, e painel de contato com histórico, mensagem sugerida editável, enviar/ligar e registro do resultado; CRM em Kanban com filtro por origem, faixa de conversão e cartões com origem colorida e tempo na etapa |
| R9 | Páginas públicas e PDFs | `Agendar.dc.html`, `Assinar.dc.html` | Pensadas primeiro para o celular: cabeçalho com a marca da clínica, etapas visíveis, botão fixo no rodapé com o resumo da escolha, linha de privacidade. Portal do paciente e PDFs com o mesmo cabeçalho e tipografia |
| R10 | Revisão final | — | Celular (390px), teclado, leitor de tela, contraste, estados vazios e de erro em todas as telas, consistência dos textos |

## Regras para o agente

1. Uma etapa R por vez, com plano antes, como nas etapas anteriores. Tirar prints (Playwright) do antes e depois de cada tela e salvar em `docs/design/screens/`.
2. Não mudar regra de negócio, permissão, consulta ao banco ou rota. Se uma melhoria de usabilidade exigir isso, anotar e perguntar.
3. Nenhuma cor ou tamanho fixo dentro das telas: tudo via tokens e componentes. Se faltar um token, criar no `globals.css`.
4. Os números que aparecem nas referências são exemplos. Na implementação, todo número vem do banco; o que ainda não existir (meta do mês, projeção, funil) só aparece depois da etapa da Fase 2 que cria o dado.
5. Acessibilidade: contraste mínimo de 4.5:1, foco visível, `aria-label` em botões de ícone, alvos de 44px no toque, e a cor nunca é o único sinal (status sempre com texto).
6. Os testes Playwright existentes continuam passando; atualizar seletores quando o texto mudar.
7. Registrar cada etapa R concluída no `docs/PROGRESS.md`.
