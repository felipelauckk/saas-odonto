import type { StatusTone } from "@/lib/status-tones";

export type SituationInput = {
  overdueCents: number;
  returnOverdue: boolean;
  inTreatment: boolean;
  openQuote: boolean;
  lastVisitAt: string | null;
  nextVisitAt: string | null;
};

/**
 * Uma situação por paciente na lista, pela ordem do que pede ação primeiro:
 * parcela vencida, retorno vencido, em tratamento, orçamento em aberto,
 * primeira consulta marcada, em dia (já veio) e, por fim, quem nunca veio.
 */
export function patientSituation(p: SituationInput): { label: string; tone: StatusTone } {
  if (p.overdueCents > 0) return { label: "Parcela vencida", tone: "danger" };
  if (p.returnOverdue) return { label: "Retorno vencido", tone: "warning" };
  if (p.inTreatment) return { label: "Em tratamento", tone: "info" };
  if (p.openQuote) return { label: "Orçamento em aberto", tone: "warning" };
  if (!p.lastVisitAt && p.nextVisitAt) return { label: "Primeira consulta", tone: "neutral" };
  if (p.lastVisitAt) return { label: "Em dia", tone: "success" };
  return { label: "Sem visitas", tone: "neutral" };
}

/** Filtros rápidos da lista (slug da URL → segmento do banco). */
export const SEGMENTS = [
  { slug: "em-tratamento", value: "in_treatment", label: "Em tratamento" },
  { slug: "orcamento-aberto", value: "open_quote", label: "Orçamento em aberto" },
  { slug: "retorno-vencido", value: "return_overdue", label: "Retorno vencido" },
  { slug: "aniversariantes", value: "birthday", label: "Aniversariantes do mês" },
] as const;

export type Segment = (typeof SEGMENTS)[number]["value"];

export function segmentFromSlug(slug: unknown): Segment | null {
  return SEGMENTS.find((s) => s.slug === slug)?.value ?? null;
}
