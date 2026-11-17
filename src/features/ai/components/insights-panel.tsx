"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";

import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/format";

import { askDataAction, monthlySummaryAction } from "../actions";

const EXAMPLES = ["Quanto cada profissional faturou neste mês?", "Qual a taxa de faltas dos últimos 30 dias?", "Quais pacientes estão sem visita há mais de 6 meses?"];

export function InsightsPanel({
  month,
  summaries,
  initialQuestion = "",
}: {
  month: string;
  summaries: { id: string; month: string; body: string; created_at: string }[];
  /** Pergunta vinda de outra tela (ex.: Relatórios); só preenche, não envia. */
  initialQuestion?: string;
}) {
  const [question, setQuestion] = useState(initialQuestion);
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summaryMonth, setSummaryMonth] = useState(month);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-10">
      <section className="space-y-3" aria-labelledby="perguntar">
        <h2 id="perguntar" className="text-base font-medium">Pergunte sobre os dados da clínica</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Label htmlFor="ai-question" className="sr-only">Pergunta</Label>
          <Input id="ai-question" className="flex-1" maxLength={500} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={EXAMPLES[0]} />
          <Button disabled={pending || question.trim().length < 5} onClick={() => startTransition(async () => {
            setError(null);
            setAnswer(null);
            const r = await askDataAction(question);
            if (r.error) setError(r.error);
            else setAnswer(r.answer ?? null);
          })}>
            <Sparkles aria-hidden />
            {pending ? "Pensando..." : "Perguntar"}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((e) => (
            <button key={e} type="button" className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-muted" onClick={() => setQuestion(e)}>{e}</button>
          ))}
        </div>
        {error ? <FormMessage state={{ status: "error", message: error }} /> : null}
        {answer ? <div className="whitespace-pre-line rounded-xl border bg-muted/30 p-4 text-sm" role="status">{answer}</div> : null}
        <p className="text-xs text-muted-foreground">A IA consulta só os relatórios do sistema, com as suas permissões. Confira os números importantes no relatório.</p>
      </section>

      <section className="space-y-3" aria-labelledby="resumo">
        <h2 id="resumo" className="text-base font-medium">Resumo do mês</h2>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="ai-month">Mês</Label>
            <Input id="ai-month" type="month" value={summaryMonth} onChange={(e) => setSummaryMonth(e.target.value)} className="w-auto" />
          </div>
          <Button variant="outline" disabled={pending} onClick={() => startTransition(async () => {
            setError(null);
            const r = await monthlySummaryAction(summaryMonth);
            if (r.error) setError(r.error);
          })}>
            {pending ? "Gerando..." : "Gerar resumo"}
          </Button>
        </div>
        {summaries.length ? (
          <ul className="space-y-3">
            {summaries.map((s) => (
              <li key={s.id} className="space-y-1 rounded-xl border p-4">
                <p className="text-xs text-muted-foreground">{s.month.slice(0, 7).split("-").reverse().join("/")} · gerado em {formatDateTime(s.created_at)}</p>
                <div className="whitespace-pre-line text-sm">{s.body}</div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum resumo gerado ainda.</p>
        )}
      </section>
    </div>
  );
}
