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

/** Seções de Configurações, agrupadas por assunto. */
export type SettingsSection = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Só aparece com a IA configurada no servidor. */
  ai?: boolean;
};

export const SETTINGS_GROUPS: readonly { title: string; sections: readonly SettingsSection[] }[] = [
  {
    title: "Clínica",
    sections: [
      { href: "/configuracoes/clinica", title: "Dados da clínica", description: "Nome, documento, contato e logo", icon: Building2 },
      { href: "/configuracoes/unidades", title: "Unidades", description: "Endereços onde a clínica atende", icon: MapPin },
      { href: "/configuracoes/membros", title: "Equipe e permissões", description: "Quem acessa e com qual papel", icon: UsersRound },
      { href: "/configuracoes/assinatura", title: "Plano e assinatura", description: "Plano, cobrança e situação", icon: CreditCard },
      { href: "/configuracoes/auditoria", title: "Auditoria", description: "Quem abriu ou alterou dados sensíveis", icon: ScrollText },
    ],
  },
  {
    title: "Atendimento",
    sections: [
      { href: "/configuracoes/profissionais", title: "Profissionais e horários", description: "Dentistas, cores e grade", icon: Stethoscope },
      { href: "/configuracoes/cadeiras", title: "Cadeiras", description: "Cadeiras de cada unidade", icon: Armchair },
      { href: "/configuracoes/procedimentos", title: "Procedimentos e preços", description: "Preço e duração", icon: ClipboardList },
      { href: "/configuracoes/marcadores", title: "Marcadores", description: "Etiquetas das consultas", icon: Tags },
      { href: "/configuracoes/anamnese", title: "Modelo de anamnese", description: "Perguntas e alertas", icon: ClipboardPlus },
      { href: "/configuracoes/fichas", title: "Fichas clínicas", description: "Fichas por especialidade", icon: NotebookPen },
      { href: "/configuracoes/documentos", title: "Documentos", description: "Receitas, atestados, termos", icon: FileText },
      { href: "/configuracoes/laboratorios", title: "Laboratórios", description: "Próteses, preços e prazos", icon: FlaskConical },
    ],
  },
  {
    title: "Financeiro",
    sections: [
      { href: "/configuracoes/formas-de-pagamento", title: "Formas de pagamento", description: "Taxas e prazos", icon: Wallet },
      { href: "/configuracoes/financeiro", title: "Cadastros financeiros", description: "Categorias, fornecedores, centros", icon: Layers },
      { href: "/configuracoes/comissoes", title: "Comissões", description: "Percentuais por profissional", icon: Percent },
      { href: "/configuracoes/cobranca", title: "Cobrança online", description: "Asaas, Pix, boleto e régua", icon: QrCode },
      { href: "/configuracoes/nota-fiscal", title: "Nota fiscal", description: "NFS-e, ISS e certificado", icon: Receipt },
    ],
  },
  {
    title: "Pacientes e captação",
    sections: [
      { href: "/configuracoes/mensagens", title: "Mensagens automáticas", description: "Lembretes e cobrança", icon: MessageSquareText },
      { href: "/configuracoes/agendamento-online", title: "Agendamento online", description: "Página pública e check-in", icon: CalendarCheck },
      { href: "/configuracoes/crm", title: "CRM", description: "Funil, campanhas e formulário", icon: Megaphone },
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
