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

export type NavGroup = { title: string; items: readonly NavItem[] };

export const navGroups: readonly NavGroup[] = [
  {
    title: "Clínica",
    items: [
      { href: "/painel", label: "Painel", icon: LayoutDashboard },
      { href: "/agenda", label: "Agenda", icon: CalendarDays },
      { href: "/pacientes", label: "Pacientes", icon: Users },
      { href: "/proteses", label: "Próteses", icon: FlaskConical },
    ],
  },
  {
    title: "Crescimento",
    items: [
      { href: "/crc", label: "CRC", icon: Headset, frontDeskOnly: true },
      { href: "/crm", label: "CRM", icon: Megaphone, frontDeskOnly: true },
      { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle, frontDeskOnly: true },
    ],
  },
  {
    title: "Gestão",
    items: [
      { href: "/orcamentos", label: "Orçamentos", icon: FileText },
      { href: "/estoque", label: "Estoque", icon: Package },
      { href: "/financeiro", label: "Financeiro", icon: Wallet },
      { href: "/relatorios", label: "Relatórios", icon: BarChart3, managersOnly: true },
      { href: "/configuracoes", label: "Configurações", icon: Settings, managersOnly: true },
    ],
  },
];

export type NavAccess = { canManage: boolean; isDentist: boolean };

/** Grupos com só os itens que o papel pode ver; grupos vazios saem. */
export function visibleNavGroups({ canManage, isDentist }: NavAccess): NavGroup[] {
  return navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => (canManage || !item.managersOnly) && !(isDentist && item.frontDeskOnly)),
    }))
    .filter((group) => group.items.length > 0);
}
