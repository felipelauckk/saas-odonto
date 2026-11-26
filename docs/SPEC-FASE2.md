# Especificação — Fase 2: paridade com o mercado

Continuação de `docs/SPEC.md`. O MVP (Etapas 1 a 11) está concluído, conforme `docs/PROGRESS.md`. Esta fase adiciona os recursos que os sistemas líderes do mercado vendem e que o sistema ainda não tem. A meta é que uma clínica que compara opções não encontre um motivo funcional para escolher outro sistema.

Todas as regras de `CLAUDE.md` e da especificação original continuam valendo: uma etapa por vez, plano antes de executar, migration para toda mudança de banco, RLS em toda tabela, permissões impostas no banco, testes, `docs/PROGRESS.md` atualizado ao fim de cada etapa.

O redesign visual vem **depois** desta fase. Nesta fase, siga o padrão visual atual e não gaste tempo com acabamento estético: as telas novas serão redesenhadas junto com as antigas.

## Referência: o que o mercado oferece

Os sistemas líderes costumam vender dois planos: um básico (agenda, prontuário, financeiro e relatórios) e um completo (soma gestão avançada, estoque, relacionamento e automação). Recursos de IA costumam ser cobrados à parte.

| Área | Recursos do mercado | Situação no nosso sistema |
| --- | --- | --- |
| Captação | CRM (funil), controle de indicação, relatórios de primeira consulta, localização e faixa etária | Só o campo "origem" no paciente |
| Agenda | Agenda inteligente, agendamento online, marcadores, múltiplos agendamentos, lista de espera, encaixes, check-in pelo app do paciente, confirmações por WhatsApp/SMS/e-mail, relatórios de faltas e desmarcações | Agenda completa, lembrete por WhatsApp e relatório de faltas. Faltam agendamento online, marcadores, sessões em série, lista de espera, check-in e desmarcações |
| Avaliação e orçamento | Orçamentos, contratos, termos, portal de assinaturas, assinatura eletrônica do paciente, certificado digital do profissional, consulta SPC, fichas clínicas por especialidade, câmera intraoral, integração com radiologia, plano de recorrência | Orçamento e prontuário prontos. Faltam documentos, assinaturas, fichas por especialidade e plano recorrente |
| Pagamento | Boleto, Pix cobrança, link de pagamento, baixa automática, régua de cobrança, NFS-e, inclusão no SPC, maquininha | Baixa manual e recibo. Faltam cobrança online ao paciente, régua, NFS-e |
| Execução do tratamento | CRC (filas de orçamentos em aberto, faltas, tratamentos em aberto, aniversariantes, inadimplência), atestados e receituários, controle protético, casos de alinhadores, alerta de retorno | Nada disso ainda |
| Financeiro da clínica | Contas a pagar, fluxo de caixa, comissões, relatórios financeiros básicos e avançados, estoque | Contas a receber e caixa do dia. Faltam contas a pagar, comissões, estoque e relatórios |
| Gestão | Metas, dashboard analítico, ranking de unidades, mais de 50 relatórios | Painel inicial com 6 indicadores |
| IA | Registro por voz, simulação de sorriso, relatórios com IA, agentes de WhatsApp para agendamento, faltas, orçamentos e cobrança | Nada |
| Apps | App do profissional, app do paciente | Web responsivo |

## Ordem de implementação

Os blocos estão em ordem de impacto comercial. O Bloco A cobre o que os planos básicos do mercado já entregam: sem ele, o sistema perde a venda na demonstração. O Bloco B cobre os planos completos. O Bloco C traz os diferenciais de IA.

### Bloco A — Paridade com os planos básicos

#### Etapa 12. Documentos clínicos e assinatura eletrônica

- Modelos de documento por clínica: receituário (simples e de controle especial), atestado, declaração de comparecimento, contrato de tratamento, termo de consentimento por procedimento, orientações pós-operatórias.
- Editor de modelos com variáveis: `{{paciente.nome}}`, `{{paciente.cpf}}`, `{{clinica.nome}}`, `{{profissional.nome}}`, `{{profissional.cro}}`, `{{orcamento.total}}`, `{{orcamento.itens}}`, `{{data.hoje}}` e outras que fizerem sentido.
- Modelos padrão criados para toda clínica nova (e para as existentes), em português, revisáveis pela clínica.
- Receituário com busca em lista de medicamentos comuns da odontologia (cadastrável pela clínica), posologia e quantidade.
- Gerar o documento a partir da ficha do paciente ou do orçamento; PDF com a identidade da clínica; histórico na nova aba "Documentos" da ficha.
- **Assinatura eletrônica do paciente:** link único e com prazo, enviado por WhatsApp ou e-mail, abre uma página pública simples com o documento, aceite por checkbox, nome digitado e assinatura desenhada no celular. Registrar data e hora, IP, navegador e o hash SHA-256 do PDF; gerar o PDF final com uma página de evidências. Documento assinado não se altera.
- Anamnese também pode ser enviada por link para o paciente preencher e assinar antes da consulta.
- Certificado digital ICP-Brasil do profissional fica fora desta etapa (registrar como pendência).

Critérios de aceite:

- [ ] O link de assinatura expira, só serve para aquele documento e não expõe nenhum outro dado do paciente.
- [ ] Qualquer alteração no PDF depois de assinado é detectável pelo hash.

#### Etapa 13. Contas a pagar e fluxo de caixa

- Contas a pagar com fornecedor, categoria, centro de custo opcional, vencimento, recorrência mensal (aluguel, salários, sistema), parcelamento e anexo do comprovante.
- Plano de categorias padrão (receitas e despesas) editável por clínica.
- Baixa de pagamento lançando saída no caixa.
- Fluxo de caixa realizado e previsto por período (dia, semana, mês), por unidade ou consolidado.
- DRE gerencial simples por mês: receita bruta, taxas, despesas por categoria, resultado.
- Importação de extrato OFX para conciliar com recebimentos e pagamentos lançados (conciliação manual assistida: o sistema sugere os pares).
- Permissões: owner/manager. Recepção só lança despesa do caixa do dia.

#### Etapa 14. Comissões

- Regra por profissional: percentual padrão e exceções por procedimento ou categoria; valor fixo opcional por procedimento.
- Base de cálculo configurável por clínica: sobre o **recebido** (padrão do mercado) ou sobre o **executado**. Opção de descontar taxa da forma de pagamento e custo de laboratório antes da comissão.
- Extrato do profissional por período: procedimentos, valores, base e comissão. O dentista vê só o próprio extrato.
- Fechamento mensal: congela o período, gera a conta a pagar do repasse e um PDF do demonstrativo.
- Usa a coluna `commission_percent` já existente e cria as tabelas de regras e fechamentos.

#### Etapa 15. Agenda avançada

- **Marcadores** (etiquetas coloridas) na consulta, configuráveis: "primeira consulta", "avaliação", "urgência", "retorno", "manutenção ortodôntica" etc. Filtro e relatório por marcador.
- **Primeira consulta** marcada automaticamente quando o paciente não tem consulta anterior realizada.
- **Múltiplos agendamentos**: criar uma série (ex.: manutenção mensal da ortodontia por 12 meses, ou 4 sessões semanais), checando conflitos em cada data e mostrando as que falharam.
- **Lista de espera**: paciente, profissional, período e preferência de horário; ao cancelar uma consulta, o sistema mostra quem da lista cabe naquele horário.
- **Desmarcações**: motivo obrigatório ao cancelar (paciente desmarcou, clínica desmarcou, remarcou), com relatório de faltas e desmarcações por período e profissional.
- **Alerta de retorno**: ao concluir um procedimento ou consulta, definir retorno em X meses (padrão por procedimento, ex.: limpeza 6 meses). Lista de retornos vencidos e a vencer; mensagem automática por WhatsApp no vencimento.
- **Sala de espera**: status "chegou" com hora; tela de recepção com quem está aguardando e há quanto tempo.

#### Etapa 16. CRC — central de relacionamento

Uma tela de trabalho diário para a recepção, com filas geradas automaticamente:

| Fila | Quem entra |
| --- | --- |
| Orçamentos em aberto | Orçamentos apresentados e não aprovados nem recusados |
| Faltas | Pacientes que faltaram e não remarcaram |
| Faltas na primeira consulta | Mesma regra, só primeira consulta |
| Tratamentos sem agendamento | Orçamento aprovado com itens pendentes e nenhuma consulta futura |
| Retornos vencidos | Alerta de retorno vencido sem consulta marcada |
| Aniversariantes | Aniversário hoje e nos próximos 7 dias |
| Inadimplentes | Parcelas vencidas |

- Cada item mostra o paciente, o motivo, o valor envolvido e o histórico de contatos.
- Ações: ligar (registra), abrir WhatsApp com mensagem pronta do modelo da fila, agendar direto, registrar resultado ("não atendeu", "vai pensar", "agendou", "sem interesse") e agendar novo contato.
- O item sai da fila sozinho quando o motivo se resolve (agendou, aprovou, pagou).
- Indicadores da CRC: contatos por dia, taxa de recuperação por fila, valor recuperado.

#### Etapa 17. CRM de captação

- Leads (pessoas que ainda não são pacientes): nome, telefone, origem (Instagram, Google, indicação, site, anúncio, passante), campanha, interesse (procedimento) e observações.
- Funil em Kanban com etapas configuráveis. Padrão: Novo contato → Em conversa → Avaliação agendada → Compareceu → Orçamento apresentado → Fechou / Perdido (com motivo).
- Converter lead em paciente reaproveitando os dados; o funil passa a acompanhar consulta e orçamento automaticamente.
- **Controle de indicação**: quem indicou (paciente ou profissional parceiro), com ranking de quem mais indica.
- Relatório de conversão por origem e por campanha, custo por lead opcional (valor investido informado pela clínica).
- Formulário público de captação (link e código para incorporar em site) que cria o lead.

#### Etapa 18. Relatórios

Central de relatórios com filtros de período, unidade e profissional, tela e exportação CSV/Excel. Mínimo:

1. Faturamento (recebido) por período, profissional, procedimento, categoria e forma de pagamento.
2. Produção: procedimentos executados por profissional e por procedimento.
3. Orçamentos: emitidos, aprovados, recusados, taxa de conversão e ticket médio, por profissional.
4. Primeira consulta: quantidade, origem e conversão em tratamento.
5. Pacientes por localização (bairro/cidade) e faixa etária.
6. Faltas e desmarcações.
7. Ocupação da agenda (horas ocupadas ÷ horas disponíveis) por profissional e cadeira.
8. Última consulta: pacientes sem visita há mais de X meses.
9. Aniversariantes do período.
10. Pagamentos vencidos e inadimplência por idade da dívida.
11. Contas a pagar e DRE.
12. Comissões por profissional.
13. Retornos (alerta de retorno) vencidos e cumpridos.
14. Desempenho da CRC e do CRM.

### Bloco B — Paridade com os planos completos

#### Etapa 19. Cobrança online ao paciente e régua de cobrança

- Cada clínica conecta a **própria** conta Asaas (chave de API guardada criptografada, só o servidor lê). O dinheiro vai direto para a clínica.
- Gerar Pix, boleto ou link de pagamento (cartão, com parcelamento) a partir de uma parcela ou de um orçamento aprovado; enviar por WhatsApp.
- Webhook do Asaas da clínica dá baixa automática no recebível e lança no caixa, com a taxa real.
- **Régua de cobrança** configurável: lembrete X dias antes do vencimento, no dia, e após 1, 3, 7 e 15 dias de atraso, com modelos de mensagem por etapa. Pausa automática quando paga ou quando a clínica marca negociação.
- Consulta e inclusão em SPC/Serasa ficam como pendência futura (exigem contrato com bureau).

#### Etapa 20. Controle protético e laboratórios

- Cadastro de laboratórios (contato, WhatsApp, tabela de preços por serviço).
- Ordem de serviço protética ligada ao paciente e ao item do orçamento: tipo de trabalho, dentes, cor, material, etapas (moldagem, prova, ajuste, cimentação etc.), data de envio e de retorno prevista, custo.
- Quadro Kanban das ordens por etapa, com alerta de atraso do laboratório e aviso para não marcar o paciente antes do retorno previsto.
- O custo da prótese entra em contas a pagar e pode ser descontado da comissão (Etapa 14).
- **Casos de alinhadores**: mesma estrutura, com número de placas, troca a cada X dias e alerta de entrega das próximas placas.

#### Etapa 21. Estoque

- Produtos com unidade, estoque mínimo, lote e validade, por unidade da clínica.
- Entradas (compra, com fornecedor e custo, podendo gerar conta a pagar), saídas manuais e transferência entre unidades.
- Kit por procedimento opcional: ao marcar o procedimento como realizado, baixa os materiais do kit.
- Alertas de estoque mínimo e de validade próxima; lista de compras sugerida.
- Relatório de consumo e custo de material por procedimento.

#### Etapa 22. Metas e dashboard analítico

- Metas mensais por clínica, unidade e profissional: faturamento, produção, orçamentos aprovados, novos pacientes, taxa de conversão.
- Dashboard analítico com gráficos de evolução mensal, metas versus realizado, funil (lead → avaliação → orçamento → fechamento), ocupação e ranking de profissionais e de unidades.
- Visão consolidada para quem tem várias unidades (Gestão de unidades + Ranking de unidades).

#### Etapa 23. Fichas clínicas por especialidade

- Construtor de fichas (como o editor de anamnese) com modelos prontos: Ortodontia (diagnóstico, aparelho, manutenções), Implantodontia (planejamento, implantes com marca, diâmetro e comprimento por dente), Endodontia (canais, odontometria, medicação), Periodontia (periograma com profundidade de sondagem e sangramento por face) e Harmonização Orofacial (mapa facial, produtos, lotes, unidades).
- Cada profissional escolhe quais fichas usa; as fichas ficam em abas no prontuário, versionadas como a anamnese (nada se edita, só se cria nova versão).

#### Etapa 24. Agendamento online, check-in e portal do paciente

- **Página pública de agendamento** da clínica (`/agendar/[slug]`): escolhe unidade, profissional ou especialidade e horário livre conforme a grade; confirma com nome, telefone e código por WhatsApp. Cria a consulta e o lead/paciente. Configurável: quais profissionais e tipos de consulta aparecem, antecedência mínima e máxima. Link pronto para Instagram e Google Meu Negócio.
- **Check-in por QR Code** na recepção: o paciente lê o código, confirma o nome e o status vira "chegou".
- **Portal do paciente** (acesso por link mágico no WhatsApp, sem senha): próximas consultas (confirmar, pedir remarcação), orçamentos (ver e aprovar), parcelas (pagar por Pix/link), documentos (ver e assinar), anamnese para preencher.

#### Etapa 25. Nota fiscal de serviço (NFS-e)

- Emissão de NFS-e por um provedor de API (avaliar Focus NFe, NFE.io ou a emissão de notas do próprio Asaas), porque cada prefeitura tem um padrão diferente.
- Configuração fiscal por clínica (CNPJ, inscrição municipal, regime, alíquota, código de serviço) e certificado A1 enviado pela clínica e guardado criptografado.
- Emitir a partir do recebimento (manual ou automático), cancelar, enviar o PDF ao paciente e listar as notas por período.

### Bloco C — Diferenciais com IA

Usar a API do Claude (Anthropic) no servidor. Toda chamada registra quem pediu e quanto custou. Nenhum dado de paciente vai para o modelo sem necessidade, e cada recurso é ligado por clínica (pode virar plano ou adicional pago).

#### Etapa 26. Registro por voz

- Botão de microfone na evolução clínica, na anamnese e no orçamento: o dentista dita, o áudio é transcrito e a IA preenche os campos estruturados (procedimentos, dentes, faces, observações). O profissional revisa antes de salvar; nada é gravado sem confirmação.

#### Etapa 27. Assistente de WhatsApp

- Atendente virtual no WhatsApp da clínica (provedor Meta já integrado na Etapa 9): responde dúvidas a partir de uma base de informações da clínica (endereço, horários, procedimentos, preços que a clínica quiser divulgar), agenda, remarca e cancela consultando a grade real, e passa para um humano quando não souber ou o paciente pedir.
- Agentes de follow-up que trabalham as filas da CRC (Etapa 16): orçamentos em aberto, faltas, tratamentos sem agendamento, retornos e inadimplência, com limite de mensagens por paciente e horário comercial.
- Caixa de entrada na tela para a equipe acompanhar e assumir conversas.

#### Etapa 28. Relatórios e insights com IA

- Pergunta em linguagem natural sobre os dados da clínica ("quanto a Dra. Ana faturou em outubro?", "quais pacientes de implante não voltaram?"), respondida com consultas que respeitam a RLS do usuário.
- Resumo mensal automático para o dono: o que melhorou, o que piorou e onde agir.

## Fora desta fase

- Certificado digital ICP-Brasil do profissional, consulta e inclusão no SPC/Serasa, maquininha própria, antecipação de recebíveis, integração com câmera intraoral e centros de radiologia, simulação de sorriso por IA, apps nativos (iOS/Android). Avaliar depois, conforme a demanda dos clientes.
- Convênios e TISS continuam fora por decisão de produto.

## Planos sugeridos para venda

Reorganizar `plans` ao fim do Bloco B, em linha com o mercado. Valores são só ponto de partida para o Felipe decidir:

| Plano | O que inclui |
| --- | --- |
| Essencial | MVP + Bloco A, exceto CRM de captação |
| Profissional | Tudo do Essencial + CRM, cobrança online e régua, prótese, estoque, metas, fichas por especialidade, agendamento online e portal |
| IA | Profissional + Bloco C |

Os recursos devem ser ligados por plano via `plans.features` (jsonb), conferido no servidor e no banco, nunca só na tela.
