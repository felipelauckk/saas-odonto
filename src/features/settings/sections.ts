/** Seções de Configurações, agrupadas como no menu lateral. */
export type SettingsSection = { href: string; title: string; description: string };

export const SETTINGS_GROUPS: readonly { title: string; sections: readonly SettingsSection[] }[] = [
  {
    title: "Clínica",
    sections: [
      { href: "/configuracoes/clinica", title: "Dados da clínica", description: "Nome, documento, contato e logo" },
      { href: "/configuracoes/unidades", title: "Unidades", description: "Endereços onde a clínica atende" },
      { href: "/configuracoes/membros", title: "Equipe e permissões", description: "Quem acessa e com qual papel" },
      { href: "/configuracoes/assinatura", title: "Plano e assinatura", description: "Plano, cobrança e situação" },
      { href: "/configuracoes/auditoria", title: "Auditoria", description: "Quem abriu ou alterou dados sensíveis" },
    ],
  },
  {
    title: "Atendimento",
    sections: [
      { href: "/configuracoes/profissionais", title: "Profissionais e horários", description: "Dentistas, cores e grade" },
      { href: "/configuracoes/cadeiras", title: "Cadeiras", description: "Cadeiras de cada unidade" },
      { href: "/configuracoes/procedimentos", title: "Procedimentos e preços", description: "Preço e duração" },
      { href: "/configuracoes/marcadores", title: "Marcadores", description: "Etiquetas das consultas" },
      { href: "/configuracoes/anamnese", title: "Modelo de anamnese", description: "Perguntas e alertas" },
      { href: "/configuracoes/fichas", title: "Fichas clínicas", description: "Fichas por especialidade" },
      { href: "/configuracoes/documentos", title: "Documentos", description: "Receitas, atestados, termos" },
      { href: "/configuracoes/laboratorios", title: "Laboratórios", description: "Próteses, preços e prazos" },
    ],
  },
  {
    title: "Financeiro",
    sections: [
      { href: "/configuracoes/formas-de-pagamento", title: "Formas de pagamento", description: "Taxas e prazos" },
      { href: "/configuracoes/financeiro", title: "Cadastros financeiros", description: "Categorias, fornecedores, centros" },
      { href: "/configuracoes/comissoes", title: "Comissões", description: "Percentuais por profissional" },
      { href: "/configuracoes/cobranca", title: "Cobrança online", description: "Asaas, Pix, boleto e régua" },
      { href: "/configuracoes/nota-fiscal", title: "Nota fiscal", description: "NFS-e, ISS e certificado" },
    ],
  },
  {
    title: "Pacientes e captação",
    sections: [
      { href: "/configuracoes/mensagens", title: "Mensagens automáticas", description: "Lembretes e cobrança" },
      { href: "/configuracoes/agendamento-online", title: "Agendamento online", description: "Página pública e check-in" },
      { href: "/configuracoes/crm", title: "CRM", description: "Funil, campanhas e formulário" },
      { href: "/configuracoes/inteligencia-artificial", title: "Inteligência artificial", description: "Assistente, follow-up e limite" },
    ],
  },
];
