import { z } from "zod";

/** Pergunta do modelo de anamnese (guardada em anamnesis_templates.questions). */
export const questionSchema = z.object({
  id: z.string().min(1).max(60),
  label: z.string().trim().min(3, "Escreva a pergunta.").max(300, "Pergunta muito longa."),
  type: z.enum(["yes_no", "text"]),
  /** "Sim" vira alerta no topo da ficha (alergias, doenças...). */
  alert: z.boolean(),
  /** Pede detalhes quando a resposta é "sim". */
  details: z.boolean(),
});

export type Question = z.infer<typeof questionSchema>;

export const questionsSchema = z
  .array(questionSchema)
  .max(80, "Máximo de 80 perguntas.")
  .refine((qs) => new Set(qs.map((q) => q.id)).size === qs.length, "Perguntas repetidas.");

/** Resposta guardada junto com a cópia da pergunta. */
export const answerSchema = questionSchema.extend({
  answer: z.enum(["yes", "no"]).nullable(),
  text: z.string().trim().max(1000).nullable(),
});

export type Answer = z.infer<typeof answerSchema>;

export const answersSchema = z.array(answerSchema).min(1).max(80);

export function parseQuestions(value: unknown): Question[] {
  const parsed = questionsSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

export function parseAnswers(value: unknown): Answer[] {
  const parsed = z.array(answerSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

/** Alertas: perguntas de alerta respondidas "sim". */
export function alertsOf(answers: Answer[]): { label: string; details: string | null }[] {
  return answers.filter((a) => a.alert && a.answer === "yes").map((a) => ({ label: a.label, details: a.text || null }));
}

/** Monta respostas vazias (ou a partir da última versão) para um modelo. */
export function answersFor(questions: Question[], previous: Answer[] = []): Answer[] {
  const byId = new Map(previous.map((a) => [a.id, a]));
  return questions.map((q) => {
    const old = byId.get(q.id);
    return { ...q, answer: old?.answer ?? null, text: old?.text ?? null };
  });
}

/** Id estável e legível para uma pergunta nova. */
export function questionId(label: string, existing: string[]): string {
  const base =
    label
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 40) || "pergunta";
  let id = base;
  for (let i = 2; existing.includes(id); i++) id = `${base}_${i}`;
  return id;
}
