"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { FormMessage } from "@/components/forms/form-message";
import { SimpleSelect } from "@/components/forms/simple-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { saveAnamnesisTemplate } from "../actions";
import { questionId, type Question } from "../anamnesis";

type Props = { templateId: string; initial: Question[] };

export function TemplateEditor({ templateId, initial }: Props) {
  const [questions, setQuestions] = useState(initial);
  const [message, setMessage] = useState<{ status: "error" | "success"; message: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();

  function change(next: Question[]) {
    setQuestions(next);
    setDirty(true);
    setMessage(null);
  }
  const update = (index: number, patch: Partial<Question>) =>
    change(questions.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  const move = (index: number, delta: number) => {
    const next = [...questions];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item!);
    change(next);
  };

  function add() {
    const label = "Nova pergunta";
    change([...questions, { id: questionId(label, questions.map((q) => q.id)), label, type: "yes_no", alert: false, details: false }]);
  }

  function save() {
    startTransition(async () => {
      const result = await saveAnamnesisTemplate({ templateId, questions });
      if (result.error) setMessage({ status: "error", message: result.error });
      else {
        setDirty(false);
        setMessage({ status: "success", message: "Modelo salvo. As próximas anamneses já usam estas perguntas." });
      }
    });
  }

  return (
    <div className="space-y-4">
      {message ? <FormMessage state={message} /> : null}
      <ol className="divide-y rounded-xl border">
        {questions.map((q, index) => (
          <li key={q.id} className="space-y-3 px-4 py-4 sm:px-5">
            <div className="flex items-start gap-2">
              <span className="pt-2 text-sm text-muted-foreground tabular-nums">{index + 1}.</span>
              <div className="flex-1 space-y-1.5">
                <Label htmlFor={`pergunta-${q.id}`} className="sr-only">
                  Pergunta {index + 1}
                </Label>
                <Input id={`pergunta-${q.id}`} value={q.label} onChange={(e) => update(index, { label: e.target.value })} />
              </div>
              <div className="flex">
                <Button type="button" variant="ghost" size="icon" aria-label={`Subir pergunta ${index + 1}`} disabled={index === 0} onClick={() => move(index, -1)}>
                  <ArrowUp />
                </Button>
                <Button type="button" variant="ghost" size="icon" aria-label={`Descer pergunta ${index + 1}`} disabled={index === questions.length - 1} onClick={() => move(index, 1)}>
                  <ArrowDown />
                </Button>
                <Button type="button" variant="ghost" size="icon" aria-label={`Remover pergunta ${index + 1}`} onClick={() => change(questions.filter((_, i) => i !== index))}>
                  <Trash2 />
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pl-6">
              <SimpleSelect
                id={`tipo-${q.id}`}
                aria-label={`Tipo da pergunta ${index + 1}`}
                value={q.type}
                onChange={(v) => update(index, { type: v as Question["type"], ...(v === "text" ? { alert: false, details: false } : {}) })}
                options={[
                  { value: "yes_no", label: "Sim ou não" },
                  { value: "text", label: "Texto livre" },
                ]}
                className="w-40 data-[size=default]:h-8 pointer-coarse:data-[size=default]:h-11"
              />
              {q.type === "yes_no" ? (
                <>
                  <Label className="flex items-center gap-2 font-normal pointer-coarse:min-h-11">
                    <Checkbox checked={q.alert} onCheckedChange={(c) => update(index, { alert: c === true })} />
                    “Sim” vira alerta
                  </Label>
                  <Label className="flex items-center gap-2 font-normal pointer-coarse:min-h-11">
                    <Checkbox checked={q.details} onCheckedChange={(c) => update(index, { details: c === true })} />
                    Pedir detalhes no “sim”
                  </Label>
                </>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" variant="outline" onClick={add}>
          <Plus aria-hidden />
          Adicionar pergunta
        </Button>
        <Button type="button" onClick={save} disabled={pending || !dirty}>
          {pending ? "Salvando..." : "Salvar modelo"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Anamneses já preenchidas guardam as perguntas da época: mudar o modelo não altera o que já foi respondido.
      </p>
    </div>
  );
}
