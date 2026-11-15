"use client";

import { useState, useTransition } from "react";
import { cn } from "cn";

import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { VoiceDictation } from "@/features/ai/components/voice-dictation";

import { saveAnamnesis } from "../actions";
import type { Answer } from "../anamnesis";

type Props = {
  patientId: string;
  templateId: string | null;
  initial: Answer[];
  onDone: () => void;
  onCancel: () => void;
};

export function AnamnesisForm({ patientId, templateId, initial, onDone, onCancel }: Props) {
  const [answers, setAnswers] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const update = (id: string, patch: Partial<Answer>) =>
    setAnswers((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await saveAnamnesis({ patientId, templateId, answers });
      if (result.error) setError(result.error);
      else onDone();
    });
  }

  const choice = (a: Answer, value: "yes" | "no", label: string) => (
    <button
      type="button"
      aria-pressed={a.answer === value}
      onClick={() => update(a.id, { answer: a.answer === value ? null : value, ...(value === "no" ? { text: null } : {}) })}
      className={cn(
        "h-9 min-w-16 rounded-lg border px-3 text-sm font-medium transition-colors pointer-coarse:h-11",
        a.answer === value
          ? value === "yes" && a.alert
            ? "border-destructive bg-destructive/10 text-destructive"
            : "border-primary bg-primary text-primary-foreground"
          : "hover:bg-muted",
      )}
    >
      {label}
    </button>
  );

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error ? <FormMessage state={{ status: "error", message: error }} /> : null}
      <div className="flex justify-end">
        <VoiceDictation
          kind="anamnesis"
          title="Ditar anamnese"
          context={{ questions: answers.map((a) => ({ id: a.id, label: a.label })) }}
          onResult={(r) =>
            setAnswers((list) =>
              list.map((a) => {
                const got = r.data.answers.find((x) => x.questionId === a.id);
                if (!got || (got.answer === null && !got.details)) return a;
                return { ...a, ...(got.answer ? { answer: got.answer } : {}), ...(got.details ? { text: got.details } : {}) };
              }),
            )
          }
        />
      </div>
      <ol className="divide-y rounded-xl border">
        {answers.map((a, index) => (
          <li key={a.id} className="space-y-2 px-4 py-3 sm:px-5">
            {a.type === "text" ? (
              <>
                <Label htmlFor={`q-${a.id}`}>
                  {index + 1}. {a.label}
                </Label>
                <Textarea id={`q-${a.id}`} rows={2} value={a.text ?? ""} onChange={(e) => update(a.id, { text: e.target.value })} />
              </>
            ) : (
              <>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm" id={`q-${a.id}`}>
                    {index + 1}. {a.label}
                  </p>
                  <div className="flex gap-2" role="group" aria-labelledby={`q-${a.id}`}>
                    {choice(a, "yes", "Sim")}
                    {choice(a, "no", "Não")}
                  </div>
                </div>
                {a.details && a.answer === "yes" ? (
                  <Input
                    aria-label={`Detalhes: ${a.label}`}
                    placeholder="Quais? Detalhe"
                    value={a.text ?? ""}
                    onChange={(e) => update(a.id, { text: e.target.value })}
                  />
                ) : null}
              </>
            )}
          </li>
        ))}
      </ol>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar anamnese"}
        </Button>
      </div>
    </form>
  );
}
