"use client";

import { useEffect, useState, useTransition } from "react";

import { FormField } from "@/components/forms/form-field";
import { SelectField } from "@/components/forms/select-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { findPatients, type PatientOption } from "@/features/agenda/actions";
import type { ActionState } from "@/lib/action-state";
import { formatPhone } from "@/lib/documents";

import { leadSources, sourceLabels } from "../labels";
import type { CrmLead } from "../queries";

export type LeadOptions = {
  campaigns: { id: string; name: string; active: boolean }[];
  partners: { id: string; name: string; active: boolean }[];
  procedures: { id: string; name: string }[];
};

/** Quem indicou: ninguém, um paciente (busca) ou um parceiro. Vai no campo "referral". */
function ReferralField({ initial, initialName, partners }: { initial: string; initialName: string | null; partners: LeadOptions["partners"] }) {
  const [kind, setKind] = useState<"none" | "patient" | "partner">(initial.startsWith("patient:") ? "patient" : initial.startsWith("partner:") ? "partner" : "none");
  const [patient, setPatient] = useState<PatientOption | null>(initial.startsWith("patient:") ? { id: initial.slice(8), name: initialName ?? "Paciente", detail: null } : null);
  const [partnerId, setPartnerId] = useState(initial.startsWith("partner:") ? initial.slice(8) : "");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientOption[]>([]);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (kind !== "patient" || patient || query.trim().length < 2) return;
    const t = setTimeout(() => startTransition(async () => setResults(await findPatients(query))), 250);
    return () => clearTimeout(t);
  }, [kind, patient, query]);

  const value = kind === "patient" && patient ? `patient:${patient.id}` : kind === "partner" && partnerId ? `partner:${partnerId}` : "";

  return (
    <div className="space-y-2">
      <input type="hidden" name="referral" value={value} />
      <p className="text-sm font-medium" id="referral-label">Indicado por</p>
      <div className="flex gap-2" role="group" aria-labelledby="referral-label">
        {(["none", "patient", "partner"] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
            className={`h-8 rounded-full border px-3 text-sm pointer-coarse:h-11 ${kind === k ? "border-foreground bg-foreground font-semibold text-background" : "text-muted-foreground hover:bg-muted"}`}
          >
            {k === "none" ? "Ninguém" : k === "patient" ? "Paciente" : "Parceiro"}
          </button>
        ))}
      </div>
      {kind === "patient" ? (
        patient ? (
          <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
            <span>{patient.name}</span>
            <button type="button" className="text-muted-foreground underline" onClick={() => { setPatient(null); setQuery(""); }}>Trocar</button>
          </div>
        ) : (
          <div className="space-y-1">
            <Input aria-label="Buscar paciente que indicou" placeholder="Nome, CPF ou telefone" value={query} onChange={(e) => setQuery(e.target.value)} />
            {query.trim().length >= 2 && results.length ? (
              <ul className="max-h-40 overflow-y-auto rounded-lg border">
                {results.map((r) => (
                  <li key={r.id}>
                    <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => setPatient(r)}>
                      {r.name}
                      {r.detail ? <span className="text-muted-foreground"> · {formatPhone(r.detail)}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )
      ) : null}
      {kind === "partner" ? (
        partners.length ? (
          <select
            aria-label="Parceiro que indicou"
            className="h-9 w-full rounded-lg border bg-background px-3 text-sm pointer-coarse:h-11"
            value={partnerId}
            onChange={(e) => setPartnerId(e.target.value)}
          >
            <option value="">Escolha o parceiro</option>
            {partners.filter((p) => p.active || p.id === partnerId).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        ) : (
          <p className="text-sm text-muted-foreground">Cadastre parceiros em Configurações &gt; CRM.</p>
        )
      ) : null}
    </div>
  );
}

export function LeadFields({ lead, state, options }: { lead?: CrmLead; state: ActionState; options: LeadOptions }) {
  const v = state.status === "error" ? state.values : undefined;
  const e = state.fieldErrors;
  return (
    <>
      {lead ? <input type="hidden" name="id" value={lead.id} /> : null}
      <FormField label="Nome" name="name" required defaultValue={v?.name ?? lead?.name ?? ""} errors={e?.name} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Telefone" name="phone" inputMode="tel" defaultValue={v?.phone ?? (lead?.phone ? formatPhone(lead.phone) : "")} errors={e?.phone} />
        <FormField label="E-mail" name="email" type="email" defaultValue={v?.email ?? lead?.email ?? ""} errors={e?.email} />
        <SelectField
          name="source"
          label="Origem"
          defaultValue={v?.source ?? lead?.source ?? "instagram"}
          options={leadSources.map((s) => ({ value: s, label: sourceLabels[s] }))}
        />
        <SelectField
          name="campaignId"
          label="Campanha"
          defaultValue={v?.campaignId ?? lead?.campaignId ?? "none"}
          options={[{ value: "none", label: "Nenhuma" }, ...options.campaigns.filter((c) => c.active || c.id === lead?.campaignId).map((c) => ({ value: c.id, label: c.name }))]}
        />
        <SelectField
          name="procedureId"
          label="Interesse (procedimento)"
          defaultValue={v?.procedureId ?? lead?.procedureId ?? "none"}
          options={[{ value: "none", label: "Não informado" }, ...options.procedures.map((p) => ({ value: p.id, label: p.name }))]}
        />
        <FormField label="Interesse (texto livre)" name="interest" defaultValue={v?.interest ?? lead?.interest ?? ""} errors={e?.interest} />
      </div>
      <ReferralField initial={v?.referral ?? lead?.referral ?? ""} initialName={lead?.referralName ?? null} partners={options.partners} />
      <div className="space-y-1.5">
        <Label htmlFor="lead-notes">Observações</Label>
        <Textarea id="lead-notes" name="notes" maxLength={1000} defaultValue={v?.notes ?? lead?.notes ?? ""} />
      </div>
    </>
  );
}
