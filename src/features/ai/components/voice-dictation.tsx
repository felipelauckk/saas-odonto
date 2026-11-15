"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Mic, Sparkles, Square } from "lucide-react";

import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { structureDictationAction, voiceAvailable } from "../actions";
import type { DictationResult } from "../voice";

// API de reconhecimento de voz do navegador (Chrome, Edge, Safari). Sem tipos no TypeScript padrão.
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

type Props<K extends DictationResult["kind"]> = {
  kind: K;
  title: string;
  context?: { procedures?: { id: string; name: string }[]; questions?: { id: string; label: string }[] };
  onResult: (result: Extract<DictationResult, { kind: K }>) => void;
};

/**
 * Ditado por voz: o navegador transcreve, o profissional confere o texto e a
 * IA organiza nos campos. Nada é salvo sem o profissional revisar e salvar.
 */
export function VoiceDictation<K extends DictationResult["kind"]>({ kind, title, context = {}, onResult }: Props<K>) {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const recognition = useRef<Recognition | null>(null);
  const supported = useRef(false);

  useEffect(() => {
    supported.current = recognitionCtor() !== null;
    let alive = true;
    voiceAvailable().then((ok) => alive && setEnabled(ok));
    return () => {
      alive = false;
      recognition.current?.stop();
    };
  }, []);

  if (!enabled) return null;

  function start() {
    const Ctor = recognitionCtor();
    if (!Ctor) return setError("Este navegador não reconhece voz. Use o Chrome, o Edge ou o Safari, ou escreva o texto.");
    const r = new Ctor();
    r.lang = "pt-BR";
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => {
      let chunk = "";
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i]!.isFinal) chunk += e.results[i]![0].transcript;
      if (chunk) setText((t) => `${t}${t && !t.endsWith(" ") ? " " : ""}${chunk.trim()}`);
    };
    r.onerror = (e) => setError(e.error === "not-allowed" ? "Permita o uso do microfone no navegador." : "O reconhecimento de voz parou. Tente de novo.");
    r.onend = () => setListening(false);
    recognition.current = r;
    setError(null);
    r.start();
    setListening(true);
  }

  function stop() {
    recognition.current?.stop();
    setListening(false);
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Mic aria-hidden />
        Ditar
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o) stop();
          setOpen(o);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>Fale normalmente. Confira o texto e toque em “Organizar”: os campos são preenchidos para você revisar antes de salvar.</DialogDescription>
          </DialogHeader>
          {error ? <FormMessage state={{ status: "error", message: error }} /> : null}
          <div className="flex gap-2">
            {listening ? (
              <Button type="button" variant="destructive" onClick={stop}>
                <Square aria-hidden />
                Parar
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={start}>
                <Mic aria-hidden />
                {text ? "Continuar ditando" : "Começar a ditar"}
              </Button>
            )}
            {listening ? <span className="self-center text-sm text-muted-foreground" role="status">Ouvindo...</span> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`dictation-${kind}`}>Texto ditado (pode corrigir)</Label>
            <Textarea id={`dictation-${kind}`} rows={6} value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              type="button"
              disabled={pending || text.trim().length < 3}
              onClick={() =>
                startTransition(async () => {
                  stop();
                  setError(null);
                  const r = await structureDictationAction({ kind, text, context });
                  if ("error" in r) setError(r.error);
                  else {
                    onResult(r as Extract<DictationResult, { kind: K }>);
                    setText("");
                    setOpen(false);
                  }
                })
              }
            >
              <Sparkles aria-hidden />
              {pending ? "Organizando..." : "Organizar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
