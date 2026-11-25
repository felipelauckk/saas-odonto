import {
  Armchair,
  Building2,
  CalendarCheck,
  ClipboardList,
  ClipboardPlus,
  CreditCard,
  FileText,
  FlaskConical,
  Layers,
  MapPin,
  Megaphone,
  MessageSquareText,
  NotebookPen,
  Percent,
  QrCode,
  Receipt,
  ScrollText,
  Sparkles,
  Stethoscope,
  Tags,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/** Uma tela de Configurações. */
export type SettingsSection = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Só aparece com a IA configurada no servidor. */
  ai?: boolean;
};

/** Área do menu de Configurações: agrupa telas do mesmo assunto. */
export type SettingsArea = {
  key: string;
  title: string;
  hint: string;
  icon: LucideIcon;
  sections: readonly SettingsSection[];
};

export const SETTINGS_AREAS: readonly SettingsArea[] = [
  {
    key: "clinica",
    title: "Clínica",
    hint: "Dados, logo e unidades",
    icon: Building2,
    sections: [
      { href: "/configuracoes/clinica", title: "Dados da clínica", description: "Nome, documento, contato e logo", icon: Building2 },
      { href: "/configuracoes/unidades", title: "Unidades", description: "Endereços onde a clínica atende", icon: MapPin },
    ],
  },
  {
    key: "equipe",
    title: "Equipe",
    hint: "Pessoas, papéis e horários",
    icon: UsersRound,
    sections: [
      { href: "/configuracoes/membros", title: "Equipe e permissões", description: "Quem acessa e com qual papel", icon: UsersRound },
      { href: "/configuracoes/profissionais", title: "Profissionais e horários", description: "Dentistas, cores e grade", icon: Stethoscope },
    ],
  },
  {
    key: "atendimento",
    title: "Atendimento",
    hint: "Cadeiras, procedimentos e preços",
    icon: ClipboardList,
    sections: [
      { href: "/configuracoes/cadeiras", title: "Cadeiras", description: "Cadeiras de cada unidade", icon: Armchair },
      { href: "/configuracoes/procedimentos", title: "Procedimentos e preços", description: "Preço e duração", icon: ClipboardList },
      { href: "/configuracoes/marcadores", title: "Marcadores", description: "Etiquetas das consultas", icon: Tags },
      { href: "/configuracoes/laboratorios", title: "Laboratórios", description: "Próteses, preços e prazos", icon: FlaskConical },
    ],
  },
  {
    key: "prontuario",
    title: "Prontuário",
    hint: "Anamnese, fichas e documentos",
    icon: NotebookPen,
    sections: [
      { href: "/configuracoes/anamnese", title: "Modelo de anamnese", description: "Perguntas e alertas", icon: ClipboardPlus },
      { href: "/configuracoes/fichas", title: "Fichas clínicas", description: "Fichas por especialidade", icon: NotebookPen },
      { href: "/configuracoes/documentos", title: "Documentos", description: "Receitas, atestados, termos", icon: FileText },
    ],
  },
  {
    key: "financeiro",
    title: "Financeiro",
    hint: "Pagamentos, comissões e nota",
    icon: Wallet,
    sections: [
      { href: "/configuracoes/formas-de-pagamento", title: "Formas de pagamento", description: "Taxas e prazos", icon: Wallet },
      { href: "/configuracoes/financeiro", title: "Cadastros financeiros", description: "Categorias, fornecedores, centros", icon: Layers },
      { href: "/configuracoes/comissoes", title: "Comissões", description: "Percentuais por profissional", icon: Percent },
      { href: "/configuracoes/cobranca", title: "Cobrança online", description: "Asaas, Pix, boleto e régua", icon: QrCode },
      { href: "/configuracoes/nota-fiscal", title: "Nota fiscal", description: "NFS-e, ISS e certificado", icon: Receipt },
    ],
  },
  {
    key: "comunicacao",
    title: "Comunicação",
    hint: "Mensagens, agendamento online e CRM",
    icon: MessageSquareText,
    sections: [
      { href: "/configuracoes/mensagens", title: "Mensagens automáticas", description: "Lembretes e cobrança", icon: MessageSquareText },
      { href: "/configuracoes/agendamento-online", title: "Agendamento online", description: "Página pública e check-in", icon: CalendarCheck },
      { href: "/configuracoes/crm", title: "CRM", description: "Funil, campanhas e formulário", icon: Megaphone },
    ],
  },
  {
    key: "conta",
    title: "Plano e conta",
    hint: "Assinatura e auditoria",
    icon: CreditCard,
    sections: [
      { href: "/configuracoes/assinatura", title: "Plano e assinatura", description: "Plano, cobrança e situação", icon: CreditCard },
      { href: "/configuracoes/auditoria", title: "Auditoria", description: "Quem abriu ou alterou dados sensíveis", icon: ScrollText },
      {
        href: "/configuracoes/inteligencia-artificial",
        title: "Inteligência artificial",
        description: "Assistente, follow-up e limite",
        icon: Sparkles,
        ai: true,
      },
    ],
  },
];

/** Áreas com as telas visíveis (as de IA só com a chave configurada). */
export function visibleSettingsAreas(aiEnabled: boolean): SettingsArea[] {
  return SETTINGS_AREAS.map((a) => ({ ...a, sections: a.sections.filter((s) => aiEnabled || !s.ai) })).filter((a) => a.sections.length > 0);
}

/** A tela de Configurações aberta (inclui subpáginas, como /configuracoes/fichas/nova). */
export function isSectionActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** A área da tela aberta, ou nula na página inicial de Configurações. */
export function findSettingsArea(areas: readonly SettingsArea[], pathname: string): SettingsArea | null {
  return areas.find((a) => a.sections.some((s) => isSectionActive(pathname, s.href))) ?? null;
}
