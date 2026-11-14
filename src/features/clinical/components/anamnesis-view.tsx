"use client";

import { useState } from "react";
import { ClipboardList, History, Pencil } from "lucide-react";
import { cn } from "cn";

import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";

import { answersFor, type Answer, type Question } from "../anamnesis";
import { AnamnesisForm } from "./anamnesis-form";

type Version = { id: string; createdAt: string; filledBy: string | null; answers: Answer[] };

type Props = {
  patientId: string;
  versions: Version[];
  template: { id: string; questions: Question[] } | null;
  canWrite: boolean;
};

function AnswerList({ answers }: { answers: Answer[] }) {
  return (
    <dl className="divide-y rounded-xl border">
      {answers.map((a) => {
        const isAlert = a.alert && a.answer === "yes";
        return (
          <div key={a.id} className={cn("flex flex-col gap-1 px-4 py-3 sm:flex-row sm:gap-4 sm:px-5", isAlert && "bg-destructive/5")}>
            <dt className="flex-1 text-sm text-muted-foreground">{a.label}</dt>
            <dd className={cn("text-sm sm:w-1/2", isAlert && "font-medium text-destructive")}>
              {a.type === "text"
                ? a.text || <span className="text-muted-foreground">—</span>
                : a.answer === "yes"
                  ? `Sim${a.text ? ` — ${a.text}` : ""}`
                  : a.answer === "no"
                    ? "Não"
                    : <span className="text-muted-foreground">Sem resposta</span>}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export function AnamnesisView({ patientId, versions, template, canWrite }: Props) {
  const [editing, setEditing] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const latest = versions[0];
  const shown = versions.find((v) => v.id === viewing) ?? latest;

  if (editing && template) {
    return (
      <AnamnesisForm
        patientId={patientId}
        templateId={template.id}
        initial={answersFor(template.questions, latest?.answers)}
        onDone={() => setEditing(false)}
        onCancel={() => setEditing(false)}
      />
    );
  }

  if (!latest) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Anamnese ainda não preenchida"
        description={canWrite ? "Preencha com o paciente antes do primeiro atendimento." : "Um dentista precisa preencher a anamnese."}
        action={
          canWrite && template ? (
            <Button onClick={() => setEditing(true)}>Preencher anamnese</Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {shown!.id === latest.id ? "Versão atual" : "Versão anterior"} · {formatDateTime(shown!.createdAt)}
          {shown!.filledBy ? ` · ${shown!.filledBy}` : ""}
        </p>
        {canWrite && template ? (
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil aria-hidden />
            Atualizar anamnese
          </Button>
        ) : null}
      </div>
      <AnswerList answers={shown!.answers} />

      {versions.length > 1 ? (
        <section className="space-y-2" aria-labelledby="historico">
          <h2 id="historico" className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <History className="size-4" aria-hidden />
            Histórico de versões
          </h2>
          <ul className="divide-y rounded-xl border">
            {versions.map((v, i) => (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => setViewing(v.id)}
                  aria-current={shown!.id === v.id ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-muted/50 pointer-coarse:min-h-11 sm:px-5",
                    shown!.id === v.id && "font-medium",
                  )}
                >
                  <span>
                    {formatDateTime(v.createdAt)}
                    {v.filledBy ? ` · ${v.filledBy}` : ""}
                  </span>
                  {i === 0 ? <span className="text-xs text-muted-foreground">atual</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
