import { describe, expect, it } from "vitest";

import { alertsOf, answersFor, questionId, questionsSchema, type Question } from "./anamnesis";

const questions: Question[] = [
  { id: "alergias", label: "Tem alergia?", type: "yes_no", alert: true, details: true },
  { id: "fumante", label: "Fuma?", type: "yes_no", alert: false, details: false },
  { id: "obs", label: "Observações", type: "text", alert: false, details: false },
];

describe("anamnese", () => {
  it("alertas são só perguntas de alerta com sim", () => {
    const answers = answersFor(questions).map((a) =>
      a.id === "alergias" ? { ...a, answer: "yes" as const, text: "Dipirona" } : a.id === "fumante" ? { ...a, answer: "yes" as const } : a,
    );
    expect(alertsOf(answers)).toEqual([{ label: "Tem alergia?", details: "Dipirona" }]);
  });

  it("nova versão parte das respostas anteriores e inclui perguntas novas", () => {
    const previous = answersFor(questions.slice(0, 1)).map((a) => ({ ...a, answer: "no" as const }));
    const next = answersFor(questions, previous);
    expect(next.map((a) => a.answer)).toEqual(["no", null, null]);
  });

  it("gera ids sem acento e sem repetir", () => {
    expect(questionId("Já teve reação à anestesia?", [])).toBe("ja_teve_reacao_a_anestesia");
    expect(questionId("Fuma?", ["fuma"])).toBe("fuma_2");
  });

  it("recusa ids repetidos no modelo", () => {
    expect(questionsSchema.safeParse([questions[0], questions[0]]).success).toBe(false);
  });
});
