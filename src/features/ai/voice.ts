import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

import { AI_FALLBACK, AI_MODEL, aiClient, checkAiAccess, recordAiUsage } from "@/lib/ai/claude";

const FACES = ["M", "O", "D", "V", "L"] as const;

export const noteSchema = z.object({
  text: z.string().describe("Evolução clínica organizada, em português, em frases curtas. Sem inventar nada que não foi dito."),
});

export const planSchema = z.object({
  items: z.array(
    z.object({
      procedureId: z.string().nullable().describe("id do procedimento da lista, ou null se nenhum corresponder"),
      description: z.string().describe("nome do procedimento como dito"),
      tooth: z.number().int().nullable().describe("dente na numeração FDI (11–48, 51–85) ou null"),
      faces: z.array(z.enum(FACES)).describe("faces: M mesial, O oclusal/incisal, D distal, V vestibular, L lingual/palatina"),
    }),
  ),
});

export const anamnesisSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string(),
      answer: z.enum(["yes", "no"]).nullable().describe("null quando a pergunta não foi respondida no ditado"),
      details: z.string().nullable(),
    }),
  ),
});

type Kind = "note" | "plan" | "anamnesis";
type Context = { procedures?: { id: string; name: string }[]; questions?: { id: string; label: string }[] };

const SYSTEM =
  "Você organiza ditados de dentistas brasileiros em campos estruturados de um prontuário odontológico. " +
  "Use só o que foi dito; não invente diagnóstico, dente, face ou procedimento. Quando algo não foi dito, deixe vazio ou null. " +
  "O texto vem de reconhecimento de voz e pode ter erros de transcrição: corrija termos odontológicos óbvios (ex.: 'mesio clusal' = mesio-oclusal).";

function prompt(kind: Kind, text: string, ctx: Context) {
  if (kind === "note") return `Organize esta evolução clínica ditada:\n\n${text}`;
  if (kind === "plan") {
    const list = (ctx.procedures ?? []).map((p) => `${p.id}: ${p.name}`).join("\n");
    return `Procedimentos cadastrados (id: nome):\n${list}\n\nExtraia os itens de orçamento deste ditado, ligando cada um ao procedimento da lista mais parecido:\n\n${text}`;
  }
  const list = (ctx.questions ?? []).map((q) => `${q.id}: ${q.label}`).join("\n");
  return `Perguntas da anamnese (id: pergunta):\n${list}\n\nPreencha as respostas a partir deste ditado (só as perguntas respondidas):\n\n${text}`;
}

const schemas = { note: noteSchema, plan: planSchema, anamnesis: anamnesisSchema };
export type DictationResult = { kind: "note"; data: z.infer<typeof noteSchema> } | { kind: "plan"; data: z.infer<typeof planSchema> } | { kind: "anamnesis"; data: z.infer<typeof anamnesisSchema> };

/**
 * Transforma o texto ditado em campos. Nada é gravado aqui: o resultado volta
 * para a tela e o profissional revisa antes de salvar. Não vai nenhum dado de
 * identificação do paciente para o modelo — só o ditado e as listas do formulário.
 */
export async function structureDictation(
  input: { clinicId: string; userId: string; kind: Kind; text: string; context: Context },
  client: Pick<Anthropic, "beta"> = aiClient(),
): Promise<{ error: string } | DictationResult> {
  const access = await checkAiAccess(input.clinicId, "voice");
  if (!access.ok) return { error: access.error };
  const response = await client.beta.messages.parse({
    model: AI_MODEL,
    max_tokens: 4000,
    ...AI_FALLBACK,
    system: SYSTEM,
    messages: [{ role: "user", content: prompt(input.kind, input.text, input.context) }],
    output_config: { effort: "low", format: betaZodOutputFormat(schemas[input.kind]) },
  });
  await recordAiUsage({ clinicId: input.clinicId, userId: input.userId, feature: "voice", usage: response.usage });
  if (response.stop_reason === "refusal" || !response.parsed_output) return { error: "Não foi possível organizar o ditado. Tente de novo ou escreva o texto." };
  return { kind: input.kind, data: response.parsed_output } as DictationResult;
}
