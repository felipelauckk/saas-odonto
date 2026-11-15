"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, Pencil } from "lucide-react";
import { cn } from "cn";

import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";

import { perioSummary, type Field, type PerioChart, type RecordData, type TableRow } from "../fields";
import type { SpecialtyRecord, SpecialtyTemplate } from "../queries";
import { PerioField, SpecialtyForm } from "./specialty-form";

const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });

function RecordView({ fields, data }: { fields: Field[]; data: RecordData }) {
  const shown = fields.filter((f) => data[f.id] !== undefined && data[f.id] !== null);
  if (!shown.length) return <p className="text-sm text-muted-foreground">Nada preenchido.</p>;
  return (
    <dl className="space-y-4">
      {shown.map((f) => {
        const v = data[f.id];
        return (
          <div key={f.id} className="space-y-1">
            <dt className="text-sm font-medium text-muted-foreground">{f.label}</dt>
            <dd className="text-sm">
              {f.type === "table" ? (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/40 text-left text-muted-foreground">
                      <tr>{(f.columns ?? []).map((c) => <th key={c.id} scope="col" className="px-2 py-1.5 font-medium">{c.label}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y">
                      {(v as TableRow[]).map((r, i) => <tr key={i}>{(f.columns ?? []).map((c) => <td key={c.id} className="px-2 py-1.5">{r[c.id] || "—"}</td>)}</tr>)}
                    </tbody>
                  </table>
                </div>
              ) : f.type === "perio" ? (
                <div className="space-y-2">
                  {(() => {
                    const s = perioSummary(v as PerioChart);
                    return <p>{s.sites} sítios avaliados · {s.pockets} com bolsa (≥ 4 mm) · sangramento em {percent.format(s.bleedingRate)}</p>;
                  })()}
                  <PerioField value={v as PerioChart} readOnly />
                </div>
              ) : f.type === "yes_no" ? (
                v ? "Sim" : "Não"
              ) : f.type === "date" ? (
                String(v).split("-").reverse().join("/")
              ) : (
                <span className="whitespace-pre-line">{String(v).replace(".", ",")}{f.unit ? ` ${f.unit}` : ""}</span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export function SpecialtyTabs({ patientId, templates, records, canWrite, selectedId, versionId }: { patientId: string; templates: SpecialtyTemplate[]; records: SpecialtyRecord[]; canWrite: boolean; selectedId: string | null; versionId: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  if (!templates.length) return <EmptyState icon={ClipboardList} title="Nenhuma ficha de especialidade" description="Escolha as fichas usadas em Configurações > Fichas clínicas." />;
  const current = templates.find((t) => t.id === selectedId) ?? templates[0]!;
  const versions = records.filter((r) => r.templateId === current.id);
  const shown = versions.find((r) => r.id === versionId) ?? versions[0] ?? null;

  return (
    <div className="space-y-4">
      <nav aria-label="Fichas de especialidade" className="flex flex-wrap gap-2">
        {templates.map((t) => (
          <Link key={t.id} href={`/pacientes/${patientId}/fichas?ficha=${t.id}`} aria-current={t.id === current.id ? "page" : undefined}
            className={cn("inline-flex h-8 items-center rounded-full border px-3 text-sm pointer-coarse:h-11", t.id === current.id ? "border-primary bg-primary/10 font-medium" : "text-muted-foreground hover:bg-muted")}>
            {t.name}
            {records.some((r) => r.templateId === t.id) ? <span className="ml-1.5 size-1.5 rounded-full bg-primary" aria-label="com registro" /> : null}
          </Link>
        ))}
      </nav>

      {editing ? (
        <SpecialtyForm
          patientId={patientId}
          templateId={current.id}
          fields={current.fields}
          initial={versions[0]?.data ?? {}}
          onDone={() => {
            setEditing(false);
            router.refresh();
          }}
        />
      ) : (
        <div className="space-y-4 rounded-xl border p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="flex-1 text-base font-medium">{current.name}</h2>
            {versions.length > 1 ? (
              <select
                aria-label="Versão"
                className="h-9 rounded-lg border bg-background px-2.5 text-sm pointer-coarse:h-11"
                value={shown?.id ?? ""}
                onChange={(e) => router.push(`/pacientes/${patientId}/fichas?ficha=${current.id}&versao=${e.target.value}`)}
              >
                {versions.map((r, i) => <option key={r.id} value={r.id}>{i === 0 ? "Atual · " : ""}{formatDateTime(r.createdAt)}</option>)}
              </select>
            ) : null}
            {canWrite ? (
              <Button size="sm" onClick={() => setEditing(true)}>
                <Pencil aria-hidden />
                {versions.length ? "Nova versão" : "Preencher"}
              </Button>
            ) : null}
          </div>
          {shown ? (
            <>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(shown.createdAt)}{shown.authorName ? ` · ${shown.authorName}` : ""}{shown.professionalName && shown.professionalName !== shown.authorName ? ` · ${shown.professionalName}` : ""} · versões não se editam: cada alteração cria uma nova.
              </p>
              <RecordView fields={shown.fields} data={shown.data} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Esta ficha ainda não foi preenchida para o paciente.</p>
          )}
        </div>
      )}
    </div>
  );
}
