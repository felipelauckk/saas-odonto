"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { cn } from "cn";

import { FormMessage } from "@/components/forms/form-message";
import { FormSection, FormSectionsFooter } from "@/components/forms/form-sections";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { addPatientSource, reorderPatientSources, saveRegistrySettings, updatePatientSource } from "../settings-actions";
import { sourcePillClass, type PatientSourceOption } from "../sources";

/** Lista de origens: incluir, renomear, ligar/desligar e mudar a ordem. */
export function SourcesManager({ sources: initial }: { sources: PatientSourceOption[] }) {
  const [sources, setSources] = useState(initial);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [message, setMessage] = useState<{ status: "error" | "success"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const run = <R extends { error?: string }>(fn: () => Promise<R>, ok?: string, onOk?: (r: R) => void) =>
    startTransition(async () => {
      const r = await fn();
      if (r.error) setMessage({ status: "error", message: r.error });
      else {
        setMessage(ok ? { status: "success", message: ok } : null);
        onOk?.(r);
      }
    });

  function move(index: number, delta: -1 | 1) {
    const next = [...sources];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    const reordered = next.map((s, position) => ({ ...s, position }));
    setSources(reordered);
    run(() => reorderPatientSources(reordered.map((s) => s.id)));
  }

  return (
    <div className="space-y-3">
      {message ? <FormMessage state={message} /> : null}
      <ul className="divide-y rounded-xl border" aria-label="Origens">
        {sources.map((s, i) => (
          <li key={s.id} className={cn("flex flex-wrap items-center gap-2 px-3 py-2", !s.active && "bg-muted/40")}>
            {editing?.id === s.id ? (
              <form
                className="flex min-w-0 flex-1 gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = editing.name;
                  run(() => updatePatientSource({ id: s.id, name }), "Origem renomeada.", () => {
                    setSources((list) => list.map((x) => (x.id === s.id ? { ...x, name: name.trim() } : x)));
                    setEditing(null);
                  });
                }}
              >
                <Input aria-label={`Novo nome de ${s.name}`} value={editing.name} maxLength={60} autoFocus onChange={(e) => setEditing({ id: s.id, name: e.target.value })} className="min-w-0 flex-1" />
                <Button type="submit" size="sm" disabled={pending}>
                  Salvar
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
                  Cancelar
                </Button>
              </form>
            ) : (
              <>
                <span className={cn("rounded-md px-2 py-0.5 text-[0.8125rem] font-semibold", s.active ? sourcePillClass(s) : "bg-muted text-muted-foreground line-through")}>{s.name}</span>
                {!s.active ? <span className="text-xs text-muted-foreground">desativada</span> : null}
                <span className="ml-auto flex items-center gap-1">
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Subir ${s.name}`} disabled={pending || i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Descer ${s.name}`} disabled={pending || i === sources.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditing({ id: s.id, name: s.name })}>
                    Renomear
                  </Button>
                  <label className="flex items-center gap-2 pl-1 text-xs text-muted-foreground pointer-coarse:min-h-11">
                    <Switch
                      checked={s.active}
                      aria-label={`${s.name} ativa`}
                      onCheckedChange={(active) =>
                        run(() => updatePatientSource({ id: s.id, active }), undefined, () => setSources((list) => list.map((x) => (x.id === s.id ? { ...x, active } : x))))
                      }
                    />
                    Ativa
                  </label>
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const name = newName;
          run(() => addPatientSource(name), "Origem incluída.", (r) => {
            setNewName("");
            if (r.source) setSources((list) => [...list, r.source!]);
          });
        }}
      >
        <Input aria-label="Nome da nova origem" placeholder="Ex.: Feira de saúde" value={newName} maxLength={60} onChange={(e) => setNewName(e.target.value)} className="min-w-0 flex-1" />
        <Button type="submit" variant="outline" disabled={pending || !newName.trim()}>
          <Plus aria-hidden />
          Incluir origem
        </Button>
      </form>
    </div>
  );
}

/** Numeração do prontuário e e-mail obrigatório. */
export function RegistrySettings({ initial }: { initial: { recordAuto: boolean; recordNext: number; requireEmail: boolean } }) {
  const [v, setV] = useState(initial);
  const [next, setNext] = useState(String(initial.recordNext));
  const [message, setMessage] = useState<{ status: "error" | "success"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <FormSection id="prontuario" title="Número de prontuário" description="Com a numeração automática, cada paciente novo recebe o próximo número. Dá para digitar à mão no cadastro.">
        <div className="space-y-4">
          <label className="flex items-center justify-between gap-4 rounded-lg border px-3 py-3">
            <span className="text-sm font-medium">Numerar automaticamente</span>
            <Switch checked={v.recordAuto} onCheckedChange={(on) => setV((x) => ({ ...x, recordAuto: on }))} aria-label="Numerar automaticamente" />
          </label>
          {v.recordAuto ? (
            <div className="max-w-48 space-y-1.5">
              <Label htmlFor="record-next">Próximo número</Label>
              <Input id="record-next" inputMode="numeric" value={next} onChange={(e) => setNext(e.target.value.replace(/\D/g, ""))} />
            </div>
          ) : null}
        </div>
      </FormSection>
      <FormSection id="email" title="E-mail no cadastro" description="Obrigatório só para quem não marcar &quot;não tem e-mail&quot;.">
        <label className="flex items-center justify-between gap-4 rounded-lg border px-3 py-3">
          <span className="text-sm font-medium">Exigir e-mail do paciente</span>
          <Switch checked={v.requireEmail} onCheckedChange={(on) => setV((x) => ({ ...x, requireEmail: on }))} aria-label="Exigir e-mail do paciente" />
        </label>
      </FormSection>
      <FormSectionsFooter note={message ? <FormMessage state={message} /> : null}>
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await saveRegistrySettings({ recordAuto: v.recordAuto, recordNext: Number(next) || 1, requireEmail: v.requireEmail });
              setMessage(r.error ? { status: "error", message: r.error } : { status: "success", message: "Regras salvas." });
            })
          }
        >
          {pending ? "Salvando..." : "Salvar regras"}
        </Button>
      </FormSectionsFooter>
    </>
  );
}

