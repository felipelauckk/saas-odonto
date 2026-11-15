"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { saveTemplate, toggleProfessionalForm } from "../actions";
import { fieldTypeLabels, fieldTypes, slugify, type Field, type FieldType } from "../fields";
import type { SpecialtyTemplate } from "../queries";

const select = "h-9 rounded-lg border bg-background px-2.5 text-sm pointer-coarse:h-11";

/** Quem usa cada ficha (marca → a ficha aparece como aba no prontuário). */
export function ProfessionalFormsMatrix({ templates, professionals, chosen }: { templates: SpecialtyTemplate[]; professionals: { id: string; name: string }[]; chosen: { professional_id: string; template_id: string }[] }) {
  const [state, setState] = useState(() => new Set(chosen.map((c) => `${c.professional_id}|${c.template_id}`)));
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const active = templates.filter((t) => t.active);
  if (!professionals.length) return <p className="text-sm text-muted-foreground">Cadastre os profissionais primeiro.</p>;
  return (
    <div className="space-y-2">
      {error ? <FormMessage state={{ status: "error", message: error }} /> : null}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Profissional</th>
              {active.map((t) => <th key={t.id} scope="col" className="px-3 py-2 text-center font-medium">{t.name}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y">
            {professionals.map((p) => (
              <tr key={p.id}>
                <th scope="row" className="px-3 py-2 text-left font-medium">{p.name}</th>
                {active.map((t) => {
                  const key = `${p.id}|${t.id}`;
                  return (
                    <td key={t.id} className="px-3 py-2 text-center">
                      <Checkbox
                        aria-label={`${p.name} usa ${t.name}`}
                        checked={state.has(key)}
                        onCheckedChange={(v) => {
                          const on = Boolean(v);
                          setState((s) => {
                            const n = new Set(s);
                            if (on) n.add(key);
                            else n.delete(key);
                            return n;
                          });
                          startTransition(async () => {
                            const r = await toggleProfessionalForm(p.id, t.id, on);
                            setError(r.error ?? null);
                          });
                        }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Profissional sem nenhuma ficha marcada vê todas as fichas ativas.</p>
    </div>
  );
}

/** Construtor de ficha: campos com tipo, opções e colunas. */
export function TemplateBuilder({ template }: { template?: SpecialtyTemplate }) {
  const router = useRouter();
  const [name, setName] = useState(template?.name ?? "");
  const [active, setActive] = useState(template?.active ?? true);
  const [fields, setFields] = useState<Field[]>(template?.fields ?? []);
  const [message, setMessage] = useState<{ status: "error" | "success"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const update = (i: number, patch: Partial<Field>) => setFields((list) => list.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const move = (i: number, d: -1 | 1) =>
    setFields((list) => {
      const n = [...list];
      const j = i + d;
      if (j < 0 || j >= n.length) return list;
      [n[i], n[j]] = [n[j]!, n[i]!];
      return n;
    });

  function addField() {
    const used = new Set(fields.map((f) => f.id));
    let id = `campo_${fields.length + 1}`;
    while (used.has(id)) id = `${id}_1`;
    setFields((list) => [...list, { id, label: "", type: "text" }]);
  }

  return (
    <div className="space-y-4">
      {message ? <FormMessage state={message} /> : null}
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-64 flex-1 space-y-1.5">
          <Label htmlFor="tpl-name">Nome da ficha</Label>
          <Input id="tpl-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </div>
        <Label className="flex items-center gap-2 font-normal pointer-coarse:min-h-11">
          <Switch checked={active} onCheckedChange={setActive} />
          {active ? "Ativa" : "Inativa"}
        </Label>
      </div>
      <ol className="space-y-3">
        {fields.map((f, i) => (
          <li key={i} className="space-y-2 rounded-xl border p-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-48 flex-1 space-y-1.5">
                <Label htmlFor={`f-${i}-label`}>Pergunta / campo</Label>
                <Input
                  id={`f-${i}-label`}
                  value={f.label}
                  maxLength={80}
                  onChange={(e) => update(i, { label: e.target.value, ...(template?.fields.some((x) => x.id === f.id) ? {} : { id: uniqueId(fields, i, e.target.value) }) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`f-${i}-type`}>Tipo</Label>
                <select id={`f-${i}-type`} className={select} value={f.type} onChange={(e) => update(i, { type: e.target.value as FieldType })}>
                  {fieldTypes.map((t) => <option key={t} value={t}>{fieldTypeLabels[t]}</option>)}
                </select>
              </div>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Subir ${f.label || "campo"}`} onClick={() => move(i, -1)}><ArrowUp /></Button>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Descer ${f.label || "campo"}`} onClick={() => move(i, 1)}><ArrowDown /></Button>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remover ${f.label || "campo"}`} onClick={() => setFields((list) => list.filter((_, j) => j !== i))}><Trash2 /></Button>
            </div>
            {f.type === "select" ? (
              <div className="space-y-1.5">
                <Label htmlFor={`f-${i}-options`}>Opções (separadas por ponto e vírgula)</Label>
                <Input id={`f-${i}-options`} defaultValue={(f.options ?? []).join("; ")} onBlur={(e) => update(i, { options: e.target.value.split(";").map((o) => o.trim()).filter(Boolean) })} />
              </div>
            ) : null}
            {f.type === "table" ? (
              <div className="space-y-1.5">
                <Label htmlFor={`f-${i}-columns`}>Colunas (separadas por ponto e vírgula)</Label>
                <Input
                  id={`f-${i}-columns`}
                  defaultValue={(f.columns ?? []).map((c) => c.label).join("; ")}
                  onBlur={(e) => {
                    const labels = e.target.value.split(";").map((o) => o.trim()).filter(Boolean);
                    const used = new Set<string>();
                    update(i, {
                      columns: labels.map((label) => {
                        const existing = f.columns?.find((c) => c.label === label);
                        let id = existing?.id ?? slugify(label);
                        while (used.has(id)) id = `${id}_1`;
                        used.add(id);
                        return { id, label };
                      }),
                    });
                  }}
                />
              </div>
            ) : null}
            {f.type === "number" ? (
              <div className="w-40 space-y-1.5">
                <Label htmlFor={`f-${i}-unit`}>Unidade (opcional)</Label>
                <Input id={`f-${i}-unit`} maxLength={12} value={f.unit ?? ""} onChange={(e) => update(i, { unit: e.target.value || undefined })} />
              </div>
            ) : null}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={addField}>
          <Plus aria-hidden />
          Adicionar campo
        </Button>
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const clean = fields.filter((f) => f.label.trim()).map((f) => ({
                ...f,
                options: f.type === "select" ? f.options : undefined,
                columns: f.type === "table" ? f.columns : undefined,
                unit: f.type === "number" ? f.unit : undefined,
              }));
              const r = await saveTemplate({ id: template?.id, name, specialty: (template?.specialty as never) ?? "other", fields: clean, active });
              setMessage(r.error ? { status: "error", message: r.error } : { status: "success", message: "Ficha salva. Fichas já preenchidas continuam com a versão antiga." });
              if (!r.error && !template && r.id) router.replace(`/configuracoes/fichas/${r.id}`);
            })
          }
        >
          {pending ? "Salvando..." : "Salvar ficha"}
        </Button>
      </div>
    </div>
  );
}

function uniqueId(fields: Field[], index: number, label: string) {
  const base = slugify(label);
  const used = new Set(fields.filter((_, j) => j !== index).map((f) => f.id));
  let id = base;
  let n = 2;
  while (used.has(id)) id = `${base}_${n++}`;
  return id;
}
