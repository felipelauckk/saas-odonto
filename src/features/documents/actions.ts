"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { formValues, type ActionState } from "@/lib/action-state";
import { subscriptionErrorMessage } from "@/lib/db-errors";
import { sha256Hex } from "@/lib/hash";
import { getSiteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getClinicLetterhead } from "@/features/plans/queries";
import { getSessionContext } from "@/features/tenancy/queries";
import { canManageClinic } from "@/features/tenancy/roles";

import { buildDocumentContext } from "./context";
import { renderDocumentPdf } from "./document-pdf";
import { documentKinds, PRESCRIPTION_KINDS } from "./labels";
import { createSignatureRequest } from "./signing";
import { renderDocument } from "./variables";

type Result = { error?: string };

const prescriptionItem = z.object({
  name: z.string().trim().min(2).max(160),
  presentation: z.string().trim().max(120).nullable(),
  dosage: z.string().trim().min(3, "Informe a posologia.").max(300),
  quantity: z.string().trim().max(60).nullable(),
});

const draftSchema = z.object({
  patientId: z.uuid(),
  templateId: z.uuid(),
  professionalId: z.uuid().nullable(),
  planId: z.uuid().nullable(),
  procedureId: z.uuid().nullable(),
  dias: z.string().max(10).nullable(),
  cid: z.string().max(20).nullable(),
  prescription: z.array(prescriptionItem).max(30).nullable(),
});

/** Texto do documento já preenchido, para revisar antes de emitir. */
export async function previewDocument(input: z.input<typeof draftSchema>): Promise<{ error?: string; title?: string; body?: string }> {
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const supabase = await createClient();
  const { data: template } = await supabase.from("document_templates").select("name, body").eq("id", parsed.data.templateId).maybeSingle();
  if (!template) return { error: "Modelo não encontrado." };
  const session = await getSessionContext();
  const built = await buildDocumentContext({ ...parsed.data, unitId: session?.activeUnit?.id });
  if (!built) return { error: "Paciente não encontrado." };
  return { title: template.name, body: renderDocument(template.body, built.context) };
}

const issueSchema = z.object({
  patientId: z.uuid(),
  templateId: z.uuid(),
  kind: z.enum(documentKinds),
  title: z.string().trim().min(2, "Informe o título.").max(160),
  body: z.string().trim().min(5, "O documento está vazio.").max(30000),
  professionalId: z.uuid().nullable(),
  planId: z.uuid().nullable(),
  prescription: z.array(prescriptionItem).max(30).nullable(),
});

/**
 * Emite o documento: grava com a sessão do usuário (a RLS decide quem pode
 * emitir cada tipo), gera o PDF e guarda o arquivo e o hash pelo servidor.
 */
export async function issueDocument(input: z.input<typeof issueSchema>): Promise<Result & { id?: string }> {
  const parsed = issueSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const data = parsed.data;
  if (PRESCRIPTION_KINDS.includes(data.kind) && !data.prescription?.length) return { error: "Inclua pelo menos um medicamento." };

  const session = await getSessionContext();
  if (!session?.clinic) return { error: "Sessão expirada. Entre novamente." };
  const supabase = await createClient();

  const { data: doc, error } = await supabase
    .from("patient_documents")
    .insert({
      clinic_id: session.clinic.id,
      patient_id: data.patientId,
      template_id: data.templateId,
      plan_id: data.planId,
      professional_id: data.professionalId,
      kind: data.kind,
      title: data.title,
      body: data.body,
      prescription: data.prescription,
      created_by: session.user.id,
    })
    .select("id, issued_at")
    .single();
  if (error) {
    return {
      error:
        subscriptionErrorMessage(error) ??
        (error.code === "42501" ? "Receituário e atestado só podem ser emitidos por quem atende (profissional ligado ao seu usuário)." : "Não foi possível emitir o documento."),
    };
  }

  const admin = createAdminClient();
  try {
    const [letterhead, built, professional] = await Promise.all([
      getClinicLetterhead(),
      buildDocumentContext({ patientId: data.patientId, unitId: session.activeUnit?.id }),
      data.professionalId ? supabase.from("professionals").select("name, cro").eq("id", data.professionalId).single() : Promise.resolve({ data: null }),
    ]);
    if (!letterhead || !built) throw new Error("dados");
    const pdf = await renderDocumentPdf(
      {
        kind: data.kind,
        title: data.title,
        body: data.body,
        professional: professional.data,
        patientName: built.patientName,
        patientAddress: built.context.paciente.endereco,
        clinicAddress: built.context.clinica.endereco,
        issuedAt: new Date(doc.issued_at),
        documentId: doc.id,
      },
      letterhead,
    );
    const path = `${session.clinic.id}/documents/${data.patientId}/${doc.id}.pdf`;
    const { error: uploadError } = await admin.storage.from("clinic").upload(path, pdf, { contentType: "application/pdf", upsert: false });
    if (uploadError) throw uploadError;
    await admin.from("patient_documents").update({ pdf_path: path, pdf_sha256: sha256Hex(pdf) }).eq("id", doc.id);
  } catch {
    // Sem PDF o documento não vale: desfaz a emissão.
    await admin.from("patient_documents").delete().eq("id", doc.id);
    return { error: "Não foi possível gerar o PDF. Tente novamente." };
  }

  revalidatePath(`/pacientes/${data.patientId}/documentos`);
  return { id: doc.id };
}

export async function cancelDocument(documentId: string): Promise<Result> {
  if (!z.uuid().safeParse(documentId).success) return { error: "Documento inválido." };
  const session = await getSessionContext();
  if (!session) return { error: "Sessão expirada." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patient_documents")
    .update({ status: "canceled", canceled_at: new Date().toISOString(), canceled_by: session.user.id })
    .eq("id", documentId)
    .select("patient_id");
  if (error) return { error: error.code === "OD001" ? "Documento assinado não pode ser cancelado." : (subscriptionErrorMessage(error) ?? "Não foi possível cancelar.") };
  if (!data.length) return { error: "Sem permissão para cancelar este documento." };
  await createAdminClient().from("signature_requests").update({ status: "revoked" }).eq("document_id", documentId).eq("status", "pending");
  revalidatePath(`/pacientes/${data[0]!.patient_id}/documentos`);
  return {};
}

const linkSchema = z.object({
  patientId: z.uuid(),
  documentId: z.uuid().nullable(),
  days: z.number().int().min(1).max(60),
});

/** Gera o link de assinatura (documento) ou de preenchimento (anamnese). */
export async function createSigningLink(input: z.input<typeof linkSchema>): Promise<Result & { url?: string; whatsappText?: string; phone?: string | null }> {
  const parsed = linkSchema.safeParse(input);
  if (!parsed.success) return { error: "Dados inválidos." };
  const session = await getSessionContext();
  if (!session?.clinic) return { error: "Sessão expirada." };
  const supabase = await createClient();

  // O usuário precisa enxergar o documento/paciente (RLS) para mandar o link.
  const { data: patient } = await supabase.from("patients").select("full_name, whatsapp, phone").eq("id", parsed.data.patientId).maybeSingle();
  if (!patient) return { error: "Paciente não encontrado." };
  let anamnesisTemplateId: string | null = null;
  let label = "o documento";
  if (parsed.data.documentId) {
    const { data: doc } = await supabase.from("patient_documents").select("title, status, pdf_sha256").eq("id", parsed.data.documentId).maybeSingle();
    if (!doc) return { error: "Documento não encontrado." };
    if (doc.status !== "issued" || !doc.pdf_sha256) return { error: "Só documentos emitidos e não assinados podem ser enviados." };
    label = doc.title;
  } else {
    const { data: template } = await supabase
      .from("anamnesis_templates")
      .select("id")
      .eq("active", true)
      .order("is_default", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!template) return { error: "A clínica não tem modelo de anamnese." };
    anamnesisTemplateId = template.id;
    label = "a anamnese";
  }

  try {
    const { token } = await createSignatureRequest({
      clinicId: session.clinic.id,
      patientId: parsed.data.patientId,
      documentId: parsed.data.documentId,
      anamnesisTemplateId,
      days: parsed.data.days,
      createdBy: session.user.id,
    });
    const url = `${await getSiteUrl()}/assinar/${token}`;
    const first = patient.full_name.split(" ")[0];
    const whatsappText = parsed.data.documentId
      ? `Olá, ${first}! A ${session.clinic.name} enviou ${label} para você ler e assinar pelo celular: ${url} (link válido por ${parsed.data.days} dias).`
      : `Olá, ${first}! Para agilizar sua consulta na ${session.clinic.name}, preencha a anamnese pelo celular: ${url} (link válido por ${parsed.data.days} dias).`;
    revalidatePath(`/pacientes/${parsed.data.patientId}`, "layout");
    return { url, whatsappText, phone: patient.whatsapp ?? patient.phone };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Não foi possível criar o link." };
  }
}

export async function revokeSigningLink(requestId: string): Promise<Result> {
  if (!z.uuid().safeParse(requestId).success) return { error: "Link inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("signature_requests").update({ status: "revoked" }).eq("id", requestId).select("patient_id");
  if (error || !data.length) return { error: "Não foi possível revogar." };
  revalidatePath(`/pacientes/${data[0]!.patient_id}`, "layout");
  return {};
}

/** Confere um PDF com os registros da clínica pelo hash SHA-256. */
export async function verifyPdf(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const file = formData.get("arquivo");
  if (!(file instanceof File) || file.size === 0) return { status: "error", message: "Escolha o arquivo PDF." };
  if (file.size > 20 * 1024 * 1024) return { status: "error", message: "Arquivo grande demais (máximo 20 MB)." };
  const hash = sha256Hex(new Uint8Array(await file.arrayBuffer()));
  const supabase = await createClient();
  const [{ data: signed }, { data: issued }] = await Promise.all([
    supabase.from("signature_requests").select("signer_name, signed_at, document_id").eq("signed_sha256", hash).maybeSingle(),
    supabase.from("patient_documents").select("title, issued_at").eq("pdf_sha256", hash).maybeSingle(),
  ]);
  if (signed) {
    return {
      status: "success",
      message: `Documento íntegro: confere com a versão assinada por ${signed.signer_name} em ${new Date(signed.signed_at!).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`,
      values: { hash },
    };
  }
  if (issued) return { status: "success", message: `Documento íntegro: confere com "${issued.title}" emitido pela clínica (sem assinatura).`, values: { hash } };
  return { status: "error", message: "Este arquivo não confere com nenhum documento da clínica: pode ter sido alterado ou não foi emitido aqui.", values: { hash } };
}

// Modelos e medicamentos (Configurações) -----------------------------------------------------

const templateSchema = z.object({
  id: z.preprocess((v) => (v === "" ? undefined : v), z.uuid().optional()),
  kind: z.enum(documentKinds),
  name: z.string().trim().min(2, "Informe o nome.").max(120),
  body: z.string().trim().min(5, "Escreva o texto do modelo.").max(20000),
  procedureId: z.preprocess((v) => (v === "" || v === "none" ? null : v), z.uuid().nullable()),
  active: z.preprocess((v) => v === "on", z.boolean()),
});

export async function saveDocumentTemplate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = templateSchema.safeParse(values);
  if (!parsed.success) return { status: "error", message: "Confira os campos.", fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  const session = await getSessionContext();
  if (!session?.clinic || !canManageClinic(session.clinic.role)) return { status: "error", message: "Só a gestão edita modelos.", values };
  const supabase = await createClient();
  const { id, kind, name, body, procedureId, active } = parsed.data;
  const row = { kind, name, body, procedure_id: procedureId, active };
  const { error } = id
    ? await supabase.from("document_templates").update(row).eq("id", id)
    : await supabase.from("document_templates").insert({ ...row, clinic_id: session.clinic.id });
  if (error) return { status: "error", message: subscriptionErrorMessage(error) ?? "Não foi possível salvar.", values };
  revalidatePath("/configuracoes/documentos");
  return { status: "success", message: "Modelo salvo." };
}

const medicationSchema = z.object({
  id: z.preprocess((v) => (v === "" ? undefined : v), z.uuid().optional()),
  name: z.string().trim().min(2, "Informe o nome.").max(160),
  presentation: z.string().trim().max(120).transform((v) => v || null),
  defaultDosage: z.string().trim().max(300).transform((v) => v || null),
  defaultQuantity: z.string().trim().max(60).transform((v) => v || null),
  specialControl: z.preprocess((v) => v === "on", z.boolean()),
  active: z.preprocess((v) => v === "on", z.boolean()),
});

export async function saveMedication(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = formValues(formData);
  const parsed = medicationSchema.safeParse(values);
  if (!parsed.success) return { status: "error", message: "Confira os campos.", fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  const session = await getSessionContext();
  if (!session?.clinic) return { status: "error", message: "Sessão expirada.", values };
  const supabase = await createClient();
  const { id, name, presentation, defaultDosage, defaultQuantity, specialControl, active } = parsed.data;
  const row = { name, presentation, default_dosage: defaultDosage, default_quantity: defaultQuantity, special_control: specialControl, active };
  const { error } = id
    ? await supabase.from("medications").update(row).eq("id", id)
    : await supabase.from("medications").insert({ ...row, clinic_id: session.clinic.id });
  if (error) return { status: "error", message: subscriptionErrorMessage(error) ?? "Sem permissão para cadastrar medicamentos.", values };
  revalidatePath("/configuracoes/documentos");
  return { status: "success", message: "Medicamento salvo." };
}
