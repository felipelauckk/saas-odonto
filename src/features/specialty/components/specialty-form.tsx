"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "cn";

import { FormMessage } from "@/components/forms/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { saveSpecialtyRecord } from "../actions";
import { PERIO_SITES, PERIO_TEETH, type Field, type PerioChart, type RecordData, type TableRow } from "../fields";

const select = "h-9 w-full rounded-lg border bg-background px-2.5 text-sm pointer-coarse:h-11";

function TableField({ field, rows, onChange }: { field: Field; rows: TableRow[]; onChange: (rows: TableRow[]) => void }) {
  const cols = field.columns ?? [];
  const empty = () => Object.fromEntries(cols.map((c) => [c.id, ""]));
  const list = rows.length ? rows : [empty()];
  return (
    <div className="space-y-2">
      {/* relative: o rótulo só para leitor de tela (sr-only) não escapa da rolagem e não alarga a página no celular */}
      <div className="relative overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-muted-foreground">
            <tr>
              {cols.map((c) => <th key={c.id} scope="col" className="px-2 py-1.5 font-medium whitespace-nowrap">{c.label}</th>)}
              <th className="w-10"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {list.map((row, i) => (
              <tr key={i}>
                {cols.map((c) => (
                  <td key={c.id} className="px-1 py-1">
                    <Input
                      aria-label={`${field.label}: ${c.label}, linha ${i + 1}`}
                      className="min-w-24"
                      value={row[c.id] ?? ""}
                      onChange={(e) => onChange(list.map((r, j) => (j === i ? { ...r, [c.id]: e.target.value } : r)))}
                    />
                  </td>
                ))}
                <td className="px-1">
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remover linha ${i + 1}`} onClick={() => onChange(list.filter((_, j) => j !== i))}>
                    <Trash2 />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...list, empty()])}>
        <Plus aria-hidden />
        Adicionar linha
      </Button>
    </div>
  );
}

/** Periograma: profundidade de sondagem (mm) e sangramento por sítio, 6 sítios por dente. */
export function PerioField({ value, onChange, readOnly = false }: { value: PerioChart; onChange?: (chart: PerioChart) => void; readOnly?: boolean }) {
  const set = (tooth: number, site: number, patch: { depth?: number | null; bleeding?: boolean }) => {
    const t = value[String(tooth)] ?? { depth: PERIO_SITES.map(() => null), bleeding: PERIO_SITES.map(() => false) };
    const next = {
      depth: t.depth.map((d, i) => (i === site && patch.depth !== undefined ? patch.depth : d)),
      bleeding: t.bleeding.map((b, i) => (i === site && patch.bleeding !== undefined ? patch.bleeding : b)),
    };
    onChange?.({ ...value, [String(tooth)]: next });
  };
  const arches = [PERIO_TEETH.slice(0, 16), PERIO_TEETH.slice(16)];
  return (
    <div className="space-y-3">
      {arches.map((arch, a) => (
        <div key={a} className="overflow-x-auto rounded-lg border">
          <table className="text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th scope="col" className="px-1.5 py-1 text-left font-medium">Sítio</th>
                {arch.map((t) => <th key={t} scope="col" className="px-0.5 py-1 font-medium tabular-nums">{t}</th>)}
              </tr>
            </thead>
            <tbody>
              {PERIO_SITES.map((site, s) => (
                <tr key={site} className={s === 3 ? "border-t-2" : undefined}>
                  <th scope="row" className="px-1.5 text-left font-medium text-muted-foreground">{site}</th>
                  {arch.map((t) => {
                    const d = value[String(t)]?.depth[s] ?? null;
                    const b = value[String(t)]?.bleeding[s] ?? false;
                    return (
                      <td key={t} className="p-0.5 text-center">
                        {readOnly ? (
                          <span className={cn("inline-block w-7 rounded tabular-nums", d !== null && d >= 4 && "font-semibold text-destructive", b && "underline decoration-destructive decoration-2")}>
                            {d ?? "·"}
                          </span>
                        ) : (
                          <span className="flex items-center gap-0.5">
                            <input
                              aria-label={`Dente ${t}, ${site}: profundidade em mm`}
                              inputMode="numeric"
                              className={cn("h-7 w-7 rounded border bg-background text-center tabular-nums", d !== null && d >= 4 && "border-destructive text-destructive")}
                              value={d ?? ""}
                              onChange={(e) => {
                                const v = e.target.value.replace(/\D/g, "");
                                set(t, s, { depth: v === "" ? null : Number(v) });
                              }}
                            />
                            <input type="checkbox" aria-label={`Dente ${t}, ${site}: sangramento`} checked={b} onChange={(e) => set(t, s, { bleeding: e.target.checked })} className="size-3 accent-[var(--destructive)]" />
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">Profundidade em mm; marque o sangramento. Bolsa de 4 mm ou mais aparece em vermelho{readOnly ? "; sangramento sublinhado" : ""}.</p>
    </div>
  );
}

export function SpecialtyForm({ patientId, templateId, fields, initial, onDone }: { patientId: string; templateId: string; fields: Field[]; initial: RecordData; onDone: () => void }) {
  const [data, setData] = useState<Record<string, unknown>>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (id: string, v: unknown) => setData((d) => ({ ...d, [id]: v }));

  return (
    <div className="space-y-4">
      {error ? <FormMessage state={{ status: "error", message: error }} /> : null}
      {fields.map((f) => {
        const id = `sf-${f.id}`;
        const v = data[f.id];
        return (
          <div key={f.id} className="space-y-1.5">
            {f.type === "yes_no" ? (
              <fieldset className="space-y-1.5">
                <legend className="text-sm font-medium">{f.label}</legend>
                <div className="flex gap-2">
                  {[{ value: true, label: "Sim" }, { value: false, label: "Não" }].map((o) => (
                    <button key={o.label} type="button" aria-pressed={v === o.value} onClick={() => set(f.id, v === o.value ? null : o.value)}
                      className={cn("h-8 rounded-full border px-4 text-sm pointer-coarse:h-11", v === o.value ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </fieldset>
            ) : (
              <>
                {f.type === "table" || f.type === "perio" ? <p className="text-sm font-medium">{f.label}</p> : <Label htmlFor={id}>{f.label}{f.unit ? ` (${f.unit})` : ""}</Label>}
                {f.type === "text" ? <Input id={id} value={(v as string) ?? ""} onChange={(e) => set(f.id, e.target.value)} /> : null}
                {f.type === "textarea" ? <Textarea id={id} rows={3} value={(v as string) ?? ""} onChange={(e) => set(f.id, e.target.value)} /> : null}
                {f.type === "number" ? <Input id={id} inputMode="decimal" className="w-32" value={v === undefined || v === null ? "" : String(v)} onChange={(e) => set(f.id, e.target.value)} /> : null}
                {f.type === "date" ? <Input id={id} type="date" className="w-auto" value={(v as string) ?? ""} onChange={(e) => set(f.id, e.target.value)} /> : null}
                {f.type === "select" ? (
                  <select id={id} className={select} value={(v as string) ?? ""} onChange={(e) => set(f.id, e.target.value)}>
                    <option value="">Não informado</option>
                    {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : null}
                {f.type === "table" ? <TableField field={f} rows={(v as TableRow[]) ?? []} onChange={(rows) => set(f.id, rows)} /> : null}
                {f.type === "perio" ? <PerioField value={(v as PerioChart) ?? {}} onChange={(c) => set(f.id, c)} /> : null}
              </>
            )}
          </div>
        );
      })}
      <div className="flex justify-end gap-2 border-t pt-4">
        <Button variant="ghost" onClick={onDone}>Cancelar</Button>
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await saveSpecialtyRecord({ patientId, templateId, data });
              if (r.error) setError(r.error);
              else onDone();
            })
          }
        >
          {pending ? "Salvando..." : "Salvar nova versão"}
        </Button>
      </div>
    </div>
  );
}
