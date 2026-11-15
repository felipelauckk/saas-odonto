import {
  CalendarDays,
  Headset,
  FileText,
  LayoutDashboard,
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
  { href: "/orcamentos", label: "Orçamentos", icon: FileText },
  { href: "/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/configuracoes", label: "Configurações", icon: Settings, managersOnly: true },
];
