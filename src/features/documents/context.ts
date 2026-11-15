import "server-only";

import { formatIsoDate } from "@/lib/dates";
import { formatCpfCnpj, formatPhone } from "@/lib/documents";
import { formatCurrency } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

import { dateVariables, formatPrescription, type DocumentContext, type PrescriptionItem } from "./variables";

type Address = { street?: string | null; number?: string | null; complement?: string | null; district?: string | null; city?: string | null; state?: string | null; cep?: string | null };

function addressLine(a: Address | null | undefined) {
  if (!a) return "";
  return [[a.street, a.number].filter(Boolean).join(", "), a.complement, a.district, [a.city, a.state].filter(Boolean).join("/"), a.cep ? `CEP ${a.cep.replace(/(\d{5})(\d{3})/, "$1-$2")}` : null]
    .filter(Boolean)
    .join(" · ");
}

export type ContextInput = {
  patientId: string;
  professionalId?: string | null;
  planId?: string | null;
  procedureId?: string | null;
  dias?: string | null;
  cid?: string | null;
  prescription?: PrescriptionItem[] | null;
  unitId?: string | null;
};

/** Monta as variáveis a partir dos dados reais (lidos com a sessão do usuário: a RLS vale). */
export async function buildDocumentContext(input: ContextInput): Promise<{ context: DocumentContext; patientName: string } | null> {
  const supabase = await createClient();
  const { data: clinicId } = await supabase.rpc("current_clinic_id");
  const [patientRes, clinicRes, professionalRes, planRes, procedureRes, unitRes] = await Promise.all([
    supabase.from("patients").select("full_name, cpf, birth_date, address, guardian_name").eq("id", input.patientId).maybeSingle(),
    supabase.from("clinics").select("name, legal_name, document_cnpj_cpf, phone").eq("id", clinicId as string).maybeSingle(),
    input.professionalId ? supabase.from("professionals").select("name, cro").eq("id", input.professionalId).maybeSingle() : Promise.resolve({ data: null }),
    input.planId
      ? supabase.from("treatment_plans").select("total_cents, discount_cents, status, treatment_items(description, tooth, price_cents, status)").eq("id", input.planId).maybeSingle()
      : Promise.resolve({ data: null }),
    input.procedureId ? supabase.from("procedures").select("name").eq("id", input.procedureId).maybeSingle() : Promise.resolve({ data: null }),
    input.unitId
      ? supabase.from("units").select("address, phone").eq("id", input.unitId).maybeSingle()
      : supabase.from("units").select("address, phone").eq("active", true).order("created_at").limit(1).maybeSingle(),
  ]);
  const patient = patientRes.data;
  const clinic = clinicRes.data;
  if (!patient || !clinic) return null;

  const plan = planRes.data;
  const decided = plan && !["draft", "presented"].includes(plan.status);
  const planItems = (plan?.treatment_items ?? []).filter((i) => (decided ? i.status !== "rejected" : true));
  const planTotal = planItems.reduce((s, i) => s + i.price_cents, 0) - (decided ? (plan?.discount_cents ?? 0) : 0);
  const unitAddress = (unitRes.data?.address ?? null) as Address | null;

  const context: DocumentContext = {
    paciente: {
      nome: patient.full_name,
      cpf: patient.cpf ? formatCpfCnpj(patient.cpf) : "",
      nascimento: patient.birth_date ? formatIsoDate(patient.birth_date) : "",
      endereco: addressLine(patient.address as Address | null),
      responsavel: patient.guardian_name ?? "",
    },
    clinica: {
      nome: clinic.name,
      cnpj: clinic.document_cnpj_cpf ? formatCpfCnpj(clinic.document_cnpj_cpf) : "",
      endereco: addressLine(unitAddress),
      cidade: unitAddress?.city ?? "",
      telefone: clinic.phone ? formatPhone(clinic.phone) : unitRes.data?.phone ? formatPhone(unitRes.data.phone) : "",
    },
    profissional: { nome: professionalRes.data?.name ?? "", cro: professionalRes.data?.cro ? `CRO ${professionalRes.data.cro}` : "" },
    orcamento: {
      total: plan ? formatCurrency(Math.max(planTotal, 0)) : "",
      itens: planItems.map((i) => `- ${i.description}${i.tooth ? ` (dente ${i.tooth})` : ""}: ${formatCurrency(i.price_cents)}`).join("\n"),
    },
    procedimento: { nome: procedureRes.data?.name ?? "" },
    data: dateVariables(),
    receita: { itens: input.prescription?.length ? formatPrescription(input.prescription) : "" },
    dias: input.dias?.trim() ?? "",
    cid: input.cid?.trim() ?? "",
  };
  return { context, patientName: patient.full_name };
}
