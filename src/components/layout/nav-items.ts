import {
  BarChart3,
  CalendarDays,
  Headset,
  Megaphone,
  MessageCircle,
  FileText,
  FlaskConical,
  LayoutDashboard,
  Package,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Só para quem administra a clínica (owner e manager). */
  managersOnly?: boolean;
  /** Escondido do dentista (recepção e gestão). */
  frontDeskOnly?: boolean;
};

export const navItems: readonly NavItem[] = [
  { href: "/painel", label: "Painel", icon: LayoutDashboard },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/pacientes", label: "Pacientes", icon: Users },
  { href: "/crc", label: "CRC", icon: Headset, frontDeskOnly: true },
  { href: "/crm", label: "CRM", icon: Megaphone, frontDeskOnly: true },
  { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle, frontDeskOnly: true },
  { href: "/orcamentos", label: "Orçamentos", icon: FileText },
  { href: "/proteses", label: "Próteses", icon: FlaskConical },
  { href: "/estoque", label: "Estoque", icon: Package },
  { href: "/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3, managersOnly: true },
  { href: "/configuracoes", label: "Configurações", icon: Settings, managersOnly: true },
];
