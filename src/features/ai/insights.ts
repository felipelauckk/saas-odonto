import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

import { reports, reportBySlug } from "@/features/reports/catalog";
import { runReportWith } from "@/features/reports/run";
import type { ReportFilters, ReportResult } from "@/features/reports/types";
import { AI_FALLBACK, AI_MODEL, aiClient, checkAiAccess, recordAiUsage } from "@/lib/ai/claude";
import { addUsage, type Usage } from "@/lib/ai/cost";
import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";
import { addDays, utcToZoned } from "@/lib/timezone";

type UserClient = Awaited<ReturnType<typeof createClient>>;

/** Resultado de relatório enxuto para a IA (no máximo 60 linhas). */
function compact(result: ReportResult) {
  return {
    colunas: result.columns.map((c) => `${c.key} (${c.label}${c.type === "money" ? ", centavos" : c.type === "percent" ? ", fração" : ""})`),
    linhas: result.rows.slice(0, 60),
    total: result.total ?? null,
    resumo: result.summary ?? [],
    observacao: result.note ?? null,
    linhas_omitidas: Math.max(0, result.rows.length - 60),
  };
}

async function runReport(supabase: UserClient, slug: string, f: Partial<ReportFilters>) {
  const def = reportBySlug.get(slug);
  if (!def) return null;
  const today = utcToZoned(new Date()).date;
  const filters: ReportFilters = {
    from: f.from ?? `${today.slice(0, 7)}-01`,
    to: f.to ?? today,
    unitId: null,
    professionalId: f.professionalId ?? null,
    months: f.months ?? 6,
    groupBy: def.groupBy?.some((g) => g.value === f.groupBy) ? f.groupBy! : (def.groupBy?.[0]?.value ?? ""),
  };
  return runReportWith(supabase, slug, filters);
}

const SYSTEM = (today: string) =>
  [
    "Você é o analista de dados de uma clínica odontológica brasileira e responde perguntas do dono ou do gestor.",
    `Hoje é ${today}.`,
    "Use só os números que as ferramentas devolverem — nunca invente. Valores em dinheiro vêm em centavos: mostre em reais (R$ 1.234,56). Frações viram porcentagem.",
    "Se nenhum relatório responde a pergunta, diga isso e sugira o relatório mais próximo.",
    "Responda em português, direto e curto (até 8 linhas), sem markdown pesado; listas simples com hífen quando ajudar.",
  ].join("\n");

/**
 * Pergunta em linguagem natural sobre os dados. A IA só consulta os relatórios
 * do sistema, executados com o login de quem perguntou (a RLS vale).
 */
export async function askData(
  input: { supabase: UserClient; clinicId: string; userId: string; question: string },
  client: Pick<Anthropic, "beta"> = aiClient(),
): Promise<{ error?: string; answer?: string }> {
  const access = await checkAiAccess(input.clinicId, "insights");
  if (!access.ok) return { error: access.error };
  const { data: pros } = await input.supabase.from("professionals").select("id, name").eq("active", true).order("name");

  const tools = [
    betaZodTool({
      name: "run_report",
      description: `Executa um relatório da clínica. Relatórios disponíveis:\n${reports.map((r) => `- ${r.slug}: ${r.description}${r.groupBy ? ` (agrupar: ${r.groupBy.map((g) => g.value).join(", ")})` : ""}`).join("\n")}`,
      inputSchema: z.object({
        slug: z.string(),
        from: z.string().nullable().describe("AAAA-MM-DD"),
        to: z.string().nullable().describe("AAAA-MM-DD"),
        group_by: z.string().nullable(),
        professional_id: z.string().nullable().describe("filtra um profissional (id de list_professionals)"),
        months: z.number().int().nullable().describe("só para sem-visita"),
      }),
      run: async (i) => {
        const iso = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
        const result = await runReport(input.supabase, i.slug, { from: iso(i.from), to: iso(i.to), groupBy: i.group_by ?? undefined, professionalId: i.professional_id, months: i.months ?? undefined });
        return result ? JSON.stringify(compact(result)) : "Relatório não existe.";
      },
    }),
    betaZodTool({
      name: "list_professionals",
      description: "Profissionais ativos da clínica (id e nome).",
      inputSchema: z.object({}),
      run: async () => JSON.stringify(pros ?? []),
    }),
  ];

  const runner = client.beta.messages.toolRunner({
    model: AI_MODEL,
    max_tokens: 4000,
    ...AI_FALLBACK,
    system: SYSTEM(utcToZoned(new Date()).date),
    messages: [{ role: "user", content: input.question }],
    tools,
    output_config: { effort: "medium" },
    max_iterations: 6,
  });
  let usage: Usage = { input_tokens: 0, output_tokens: 0 };
  let final: Anthropic.Beta.BetaMessage | null = null;
  for await (const message of runner) {
    usage = addUsage(usage, message.usage);
    final = message;
  }
  await recordAiUsage({ clinicId: input.clinicId, userId: input.userId, feature: "insights", usage });
  if (!final || final.stop_reason === "refusal") return { error: "Não foi possível responder essa pergunta." };
  const answer = final.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
  return answer ? { answer } : { error: "Sem resposta." };
}

const SUMMARY_REPORTS: { slug: string; groupBy?: string }[] = [
  { slug: "faturamento", groupBy: "profissional" },
  { slug: "producao", groupBy: "profissional" },
  { slug: "orcamentos" },
  { slug: "primeira-consulta" },
  { slug: "faltas" },
  { slug: "inadimplencia" },
  { slug: "crc-crm" },
];

/** Resumo do mês para o dono: o que melhorou, o que piorou e onde agir (com o mês anterior para comparar). */
export async function monthlySummary(
  input: { supabase: UserClient; clinicId: string; userId: string; month: string },
  client: Pick<Anthropic, "beta"> = aiClient(),
): Promise<{ error?: string; body?: string }> {
  const access = await checkAiAccess(input.clinicId, "insights");
  if (!access.ok) return { error: access.error };
  const [y, m] = input.month.split("-").map(Number) as [number, number];
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
  const end = (month: string) => {
    const [yy, mm] = month.split("-").map(Number) as [number, number];
    return addDays(mm === 12 ? `${yy + 1}-01-01` : `${yy}-${String(mm + 1).padStart(2, "0")}-01`, -1);
  };
  const data: Record<string, unknown> = {};
  for (const r of SUMMARY_REPORTS) {
    for (const [label, month] of [["mes", input.month], ["mes_anterior", prev]] as const) {
      const result = await runReport(input.supabase, r.slug, { from: `${month}-01`, to: end(month), groupBy: r.groupBy });
      if (result) data[`${r.slug}.${label}`] = { total: result.total ?? null, resumo: result.summary ?? [], linhas: result.rows.slice(0, 15) };
    }
  }
  const response = await client.beta.messages.create({
    model: AI_MODEL,
    max_tokens: 3000,
    ...AI_FALLBACK,
    system: SYSTEM(utcToZoned(new Date()).date),
    messages: [
      {
        role: "user",
        content: `Escreva o resumo de ${input.month} para o dono da clínica, comparando com ${prev}. Três partes curtas com títulos simples: "O que melhorou", "O que piorou" e "Onde agir" (3 a 5 ações práticas). Até 20 linhas.\n\nDados (JSON):\n${JSON.stringify(data)}`,
      },
    ],
    output_config: { effort: "medium" },
  });
  await recordAiUsage({ clinicId: input.clinicId, userId: input.userId, feature: "insights", usage: response.usage });
  if (response.stop_reason === "refusal") return { error: "Não foi possível gerar o resumo." };
  const body = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
  if (!body) return { error: "Sem resposta." };
  await createAdminClient().from("ai_insights").insert({ clinic_id: input.clinicId, month: `${input.month}-01`, body, created_by: input.userId });
  return { body };
}
