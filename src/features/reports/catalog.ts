export type FilterKey = "period" | "unit" | "professional" | "months" | "groupBy";

export type ReportDef = {
  slug: string;
  title: string;
  description: string;
  filters: FilterKey[];
  groupBy?: { value: string; label: string }[];
  /** Exporta dados pessoais de pacientes (registra na auditoria). */
  personalData?: boolean;
};

export const reports: readonly ReportDef[] = [
  {
    slug: "faturamento",
    title: "Faturamento",
    description: "Recebido no período por mês, profissional, procedimento, categoria ou forma de pagamento.",
    filters: ["period", "unit", "professional", "groupBy"],
    groupBy: [
      { value: "mes", label: "Mês" },
      { value: "profissional", label: "Profissional" },
      { value: "procedimento", label: "Procedimento" },
      { value: "categoria", label: "Categoria" },
      { value: "forma", label: "Forma de pagamento" },
    ],
  },
  { slug: "producao", title: "Produção", description: "Procedimentos executados por profissional e por procedimento.", filters: ["period", "unit", "professional", "groupBy"], groupBy: [{ value: "profissional", label: "Profissional" }, { value: "procedimento", label: "Procedimento" }] },
  { slug: "orcamentos", title: "Orçamentos", description: "Emitidos, aprovados, recusados, conversão e ticket médio por profissional.", filters: ["period", "unit", "professional"] },
  { slug: "primeira-consulta", title: "Primeira consulta", description: "Quantidade, origem do paciente e conversão em tratamento.", filters: ["period", "unit", "professional"] },
  { slug: "pacientes", title: "Pacientes por local e idade", description: "Bairro, cidade e faixa etária dos pacientes ativos.", filters: ["groupBy"], groupBy: [{ value: "cidade", label: "Cidade" }, { value: "bairro", label: "Bairro" }, { value: "idade", label: "Faixa etária" }] },
  { slug: "faltas", title: "Faltas e desmarcações", description: "Por profissional, com taxa de faltas e motivos de desmarcação.", filters: ["period", "unit", "professional"] },
  { slug: "ocupacao", title: "Ocupação da agenda", description: "Horas ocupadas ÷ horas disponíveis por profissional e cadeira.", filters: ["period", "unit", "groupBy"], groupBy: [{ value: "profissional", label: "Profissional" }, { value: "cadeira", label: "Cadeira" }] },
  { slug: "sem-visita", title: "Pacientes sem visita", description: "Última consulta há mais de X meses e nada marcado.", filters: ["months", "unit"], personalData: true },
  { slug: "aniversariantes", title: "Aniversariantes", description: "Pacientes que fazem aniversário no período.", filters: ["period"], personalData: true },
  { slug: "inadimplencia", title: "Inadimplência", description: "Parcelas vencidas por idade da dívida.", filters: ["unit", "professional"], personalData: true },
  { slug: "despesas", title: "Contas a pagar e DRE", description: "Despesas por categoria e resultado do período.", filters: ["period", "unit"] },
  { slug: "comissoes", title: "Comissões", description: "Comissão calculada por profissional em cada mês do período.", filters: ["period", "professional"] },
  { slug: "retornos", title: "Retornos", description: "Alertas de retorno vencidos, cumpridos e dispensados.", filters: ["period", "professional"] },
  { slug: "consumo", title: "Consumo de material", description: "Materiais baixados por procedimento e custo de material.", filters: ["period", "unit", "groupBy"], groupBy: [{ value: "procedimento", label: "Procedimento" }, { value: "produto", label: "Material" }] },
  { slug: "crc-crm", title: "CRC e CRM", description: "Contatos e recuperação da CRC; leads e conversão do CRM.", filters: ["period"] },
];

export const reportBySlug = new Map(reports.map((r) => [r.slug, r]));
