import type { Metadata } from "next";
import Link from "next/link";
import {
  Armchair,
  Building2,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileText,
  Landmark,
  MapPin,
  MessageCircle,
  Percent,
  Receipt,
  ShieldCheck,
  Stethoscope,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { getSettingsSummary } from "@/features/settings/queries";
import { requireManager } from "@/features/tenancy/guards";

export const metadata: Metadata = { title: "Configurações" };

type Section = { href: string; title: string; description: string; icon: LucideIcon; meta?: string; warning?: string };

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export default async function Page() {
  await requireManager();
  const summary = await getSettingsSummary();

  const sections: Section[] = [
    { href: "/configuracoes/clinica", title: "Clínica", description: "Nome, documento, contato e logo.", icon: Building2 },
    { href: "/configuracoes/assinatura", title: "Assinatura", description: "Plano, cobrança e situação da conta.", icon: Receipt },
    {
      href: "/configuracoes/unidades",
      title: "Unidades",
      description: "Endereços onde a clínica atende.",
      icon: MapPin,
      meta: plural(summary.units, "unidade ativa", "unidades ativas"),
    },
    {
      href: "/configuracoes/cadeiras",
      title: "Cadeiras",
      description: "Cadeiras de atendimento de cada unidade.",
      icon: Armchair,
      meta: plural(summary.chairs, "cadeira", "cadeiras"),
    },
    {
      href: "/configuracoes/profissionais",
      title: "Profissionais",
      description: "Dentistas, cores na agenda e horários de atendimento.",
      icon: UserRound,
      meta: plural(summary.professionals, "profissional", "profissionais"),
    },
    {
      href: "/configuracoes/procedimentos",
      title: "Procedimentos",
      description: "Tabela de procedimentos com preço e duração.",
      icon: Stethoscope,
      meta: plural(summary.procedures, "procedimento", "procedimentos"),
      warning: summary.unpriced ? plural(summary.unpriced, "sem preço", "sem preço") : undefined,
    },
    { href: "/configuracoes/comissoes", title: "Comissões", description: "Percentuais e exceções por profissional.", icon: Percent },
    { href: "/configuracoes/financeiro", title: "Cadastros financeiros", description: "Categorias, fornecedores e centros de custo.", icon: Landmark },
    {
      href: "/configuracoes/formas-de-pagamento",
      title: "Formas de pagamento",
      description: "Taxas e prazos de recebimento.",
      icon: CreditCard,
      meta: plural(summary.paymentMethods, "forma ativa", "formas ativas"),
    },
    { href: "/configuracoes/documentos", title: "Documentos", description: "Modelos de receitas, atestados, contratos e termos.", icon: FileText },
    {
      href: "/configuracoes/anamnese",
      title: "Modelo de anamnese",
      description: "Perguntas da anamnese e quais viram alerta.",
      icon: ClipboardList,
    },
    {
      href: "/configuracoes/mensagens",
      title: "Mensagens",
      description: "Lembretes e textos enviados pelo WhatsApp.",
      icon: MessageCircle,
    },
    { href: "/configuracoes/auditoria", title: "Auditoria", description: "Quem abriu ou alterou dados sensíveis.", icon: ShieldCheck },
    { href: "/configuracoes/membros", title: "Equipe", description: "Quem acessa a clínica e com qual papel.", icon: Users },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title="Configurações" description="Dados da clínica, unidades, equipe e tabelas usadas no dia a dia." />
      <ul className="grid gap-3 sm:grid-cols-2">
        {sections.map(({ href, title, description, icon: Icon, meta, warning }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex h-full items-start gap-4 rounded-xl border p-5 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 space-y-1">
                <span className="block font-medium">{title}</span>
                <span className="block text-sm text-muted-foreground">{description}</span>
                {meta || warning ? (
                  <span className="flex flex-wrap gap-x-3 pt-1 text-xs">
                    {meta ? <span className="text-muted-foreground">{meta}</span> : null}
                    {warning ? <span className="font-medium text-amber-700 dark:text-amber-500">{warning}</span> : null}
                  </span>
                ) : null}
              </span>
              <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
