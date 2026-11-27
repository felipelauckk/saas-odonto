"use client";

import { useState } from "react";
import { History, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDateTime } from "@/lib/format";

import { loadPatientHistory, type PatientHistoryEntry } from "../actions";
import { educationLabels, genderLabels, maritalLabels } from "../labels";

/** Nome de cada campo do cadastro no histórico. */
const FIELD_LABELS: Record<string, string> = {
  full_name: "Nome",
  nickname: "Como prefere ser chamado",
  cpf: "CPF",
  rg: "RG",
  birth_date: "Nascimento",
  gender: "Gênero",
  marital_status: "Estado civil",
  education: "Escolaridade",
  record_number: "Nº de prontuário",
  phone_country: "País do celular",
  phone: "Celular",
  whatsapp: "WhatsApp",
  landline: "Telefone fixo",
  email: "E-mail",
  no_email: "Não tem e-mail",
  instagram: "Instagram",
  facebook: "Facebook",
  preferred_contact: "Falar com",
  address: "Endereço",
  guardian_name: "Responsável",
  guardian_relationship: "Parentesco",
  guardian_cpf: "CPF do responsável",
  guardian_rg: "RG do responsável",
  guardian_birth_date: "Nascimento do responsável",
  guardian_phone: "Telefone do responsável",
  father_name: "Pai",
  mother_name: "Mãe",
  occupation: "Profissão",
  workplace: "Local de trabalho",
  source_id: "Origem",
  referred_by_patient_id: "Indicado por (paciente)",
  referred_by_partner_id: "Indicado por (parceiro)",
  notes: "Observações",
  consent_lgpd_at: "Consentimento LGPD",
  archived_at: "Arquivado",
  photo_path: "Foto",
};

/** Valor legível; ids e caminhos viram só "alterado". */
function show(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "vazio";
  if (key === "gender") return genderLabels[value as keyof typeof genderLabels] ?? String(value);
  if (key === "marital_status") return maritalLabels[value as keyof typeof maritalLabels] ?? String(value);
  if (key === "education") return educationLabels[value as keyof typeof educationLabels] ?? String(value);
  if (key === "preferred_contact") return value === "guardian" ? "Responsável" : "Paciente";
  if (typeof value === "boolean") return value ? "sim" : "não";
  if (key.endsWith("_id") || key === "photo_path") return "definido";
  if (key === "consent_lgpd_at" || key === "archived_at") return formatDateTime(String(value));
  if (key === "address" && typeof value === "object") {
    const a = value as Record<string, string | null>;
    return [a.street, a.number, a.district, a.city, a.state].filter(Boolean).join(", ") || "vazio";
  }
  return String(value);
}

export function PatientHistoryButton({ patientId }: { patientId: string }) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<PatientHistoryEntry[] | null>(null);

  async function openSheet() {
    setOpen(true);
    setEntries(null);
    setEntries(await loadPatientHistory(patientId));
  }

  return (
    <>
      <Button type="button" variant="ghost" onClick={openSheet}>
        <History aria-hidden />
        Ver histórico
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto data-[side=right]:sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="type-title">Histórico do cadastro</SheetTitle>
            <SheetDescription>Quem mudou o quê, e quando.</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            {entries === null ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Carregando…
              </p>
            ) : entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma alteração registrada ainda. O histórico começa a contar a partir de agora.</p>
            ) : (
              <ol className="space-y-4" aria-label="Alterações">
                {entries.map((h, i) => {
                  const fields = Object.entries(h.changes).filter(([k]) => FIELD_LABELS[k]);
                  return (
                    <li key={i} className="space-y-1.5 rounded-xl border p-3">
                      <p className="text-[0.8125rem] font-semibold">
                        {h.action === "insert" ? "Cadastro criado" : "Cadastro alterado"} · {h.userName}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(h.at)}</p>
                      {h.action === "update" && fields.length ? (
                        <ul className="space-y-0.5 text-[0.8125rem]">
                          {fields.map(([k, c]) => (
                            <li key={k}>
                              <span className="font-medium">{FIELD_LABELS[k]}:</span> <span className="text-muted-foreground line-through">{show(k, c.from)}</span> → {show(k, c.to)}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
