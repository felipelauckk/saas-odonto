"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "cn";

import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { Answer } from "@/features/clinical/anamnesis";
import { submitSignature } from "@/app/assinar/[token]/actions";

import { SignaturePad } from "./signature-pad";

type Props = { token: string; purpose: "document" | "anamnesis"; questions: Answer[] | null };

export function PublicSigningForm({ token, purpose, questions }: Props) {
  const [answers, setAnswers] = useState<Answer[]>(questions ?? []);
  const [accepted, setAccepted] = useState(false);
  const [name, setName] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const update = (id: string, patch: Partial<Answer>) => setAnswers((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  if (done) {
    return (
      <div role="status" className="flex flex-col items-center gap-3 rounded-xl border p-8 text-center">
        <CheckCircle2 className="size-10 text-emerald-600" aria-hidden />
        <p className="text-lg font-medium">{purpose === "document" ? "Documento assinado" : "Anamnese enviada"}</p>
        <p className="text-sm text-muted-foreground">Pronto! A clínica já recebeu. Você pode fechar esta página.</p>
      </div>
    );
  }

  function submit() {
    setError(null);
    if (!signature) return setError("Desenhe sua assinatura no quadro.");
    startTransition(async () => {
      const result = await submitSignature({ token, accepted: accepted as true, signerName: name, signature, answers: purpose === "anamnesis" ? answers : undefined });
      if (result.error) setError(result.error);
      else setDone(true);
    });
  }

  return (
    <div className="space-y-6">
      {purpose === "anamnesis" ? (
        <ol className="divide-y rounded-xl border">
          {answers.map((a, i) => (
            <li key={a.id} className="space-y-2 px-4 py-3">
              <p className="text-sm" id={`p-${a.id}`}>
                {i + 1}. {a.label}
              </p>
              {a.type === "text" ? (
                <Textarea aria-labelledby={`p-${a.id}`} rows={2} value={a.text ?? ""} onChange={(e) => update(a.id, { text: e.target.value })} />
              ) : (
                <>
                  <div className="flex gap-2" role="group" aria-labelledby={`p-${a.id}`}>
                    {(["yes", "no"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        aria-pressed={a.answer === v}
                        onClick={() => update(a.id, { answer: v, ...(v === "no" ? { text: null } : {}) })}
                        className={cn("h-11 min-w-20 rounded-lg border px-4 text-sm font-medium", a.answer === v ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}
                      >
                        {v === "yes" ? "Sim" : "Não"}
                      </button>
                    ))}
                  </div>
                  {a.details && a.answer === "yes" ? (
                    <Input aria-label={`Detalhes: ${a.label}`} placeholder="Quais? Detalhe" value={a.text ?? ""} onChange={(e) => update(a.id, { text: e.target.value })} />
                  ) : null}
                </>
              )}
            </li>
          ))}
        </ol>
      ) : null}

      <section className="space-y-4 rounded-xl border p-5" aria-label="Assinatura">
        {error ? <FormMessage state={{ status: "error", message: error }} /> : null}
        <Label className="flex items-start gap-3 font-normal leading-normal">
          <Checkbox checked={accepted} onCheckedChange={(c) => setAccepted(c === true)} className="mt-0.5" />
          {purpose === "document" ? "Li o documento acima e concordo com o seu conteúdo." : "Confirmo que as respostas acima são verdadeiras."}
        </Label>
        <div className="space-y-1.5">
          <Label htmlFor="signer-name">Seu nome completo</Label>
          <Input id="signer-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <span className="text-sm font-medium">Assinatura</span>
          <SignaturePad onChange={setSignature} />
        </div>
        <Button className="h-11 w-full" onClick={submit} disabled={pending || !accepted}>
          {pending ? "Enviando..." : purpose === "document" ? "Assinar documento" : "Enviar anamnese assinada"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Registramos data, hora, endereço IP e navegador como prova da assinatura, conforme a Lei 14.063/2020.
        </p>
      </section>
    </div>
  );
}
