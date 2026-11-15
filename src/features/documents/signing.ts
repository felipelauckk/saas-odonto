import "server-only";

import { randomUUID } from "node:crypto";

import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { createElement as h } from "react";

import { answersSchema, type Answer } from "@/features/clinical/anamnesis";
import { formatDateTime } from "@/lib/format";
import { generateToken, isWellFormedToken, sha256Hex } from "@/lib/hash";
import { createAdminClient } from "@/lib/supabase/admin";

import { appendEvidencePage } from "./evidence";

type Admin = ReturnType<typeof createAdminClient>;

export const SIGNATURE_MAX_BYTES = 400 * 1024;

/** Cria o pedido de assinatura e devolve o token (que só existe aqui e no link). */
export async function createSignatureRequest(input: {
  clinicId: string;
  patientId: string;
  documentId?: string | null;
  anamnesisTemplateId?: string | null;
  days: number;
  createdBy: string | null;
}): Promise<{ token: string; expiresAt: string }> {
  const admin = createAdminClient();
  if (input.documentId) {
    // Um link ativo por documento: o anterior é revogado.
    await admin.from("signature_requests").update({ status: "revoked" }).eq("document_id", input.documentId).eq("status", "pending");
  }
  const token = generateToken();
  const expiresAt = new Date(Date.now() + input.days * 86_400_000).toISOString();
  const { error } = await admin.from("signature_requests").insert({
    clinic_id: input.clinicId,
    patient_id: input.patientId,
    purpose: input.documentId ? "document" : "anamnesis",
    document_id: input.documentId ?? null,
    anamnesis_template_id: input.anamnesisTemplateId ?? null,
    token_hash: sha256Hex(token),
    expires_at: expiresAt,
    created_by: input.createdBy,
  });
  if (error) throw new Error("Não foi possível criar o link de assinatura.");
  return { token, expiresAt };
}

export type PublicSigning =
  | { state: "invalid" }
  | { state: "expired" | "used" }
  | {
      state: "ok";
      requestId: string;
      purpose: "document" | "anamnesis";
      clinicName: string;
      expiresAt: string;
      document: { title: string; body: string } | null;
      anamnesis: { templateId: string; questions: Answer[] } | null;
    };

/**
 * O que a página pública pode mostrar. Só o conteúdo daquele documento (ou as
 * perguntas da anamnese) e o nome da clínica — nenhum outro dado do paciente.
 */
export async function loadPublicSigning(token: string): Promise<PublicSigning> {
  if (!isWellFormedToken(token)) return { state: "invalid" };
  const admin = createAdminClient();
  const { data: req } = await admin
    .from("signature_requests")
    .select("id, clinic_id, purpose, document_id, anamnesis_template_id, status, expires_at")
    .eq("token_hash", sha256Hex(token))
    .maybeSingle();
  if (!req) return { state: "invalid" };
  if (req.status !== "pending") return { state: req.status === "signed" ? "used" : "invalid" };
  if (new Date(req.expires_at) <= new Date()) return { state: "expired" };

  const { data: clinic } = await admin.from("clinics").select("name").eq("id", req.clinic_id).single();
  if (req.purpose === "document") {
    const { data: doc } = await admin.from("patient_documents").select("title, body, status").eq("id", req.document_id!).single();
    if (!doc || doc.status !== "issued") return { state: "invalid" };
    return { state: "ok", requestId: req.id, purpose: "document", clinicName: clinic?.name ?? "", expiresAt: req.expires_at, document: { title: doc.title, body: doc.body }, anamnesis: null };
  }
  const { data: template } = await admin.from("anamnesis_templates").select("id, questions").eq("id", req.anamnesis_template_id!).single();
  const questions = answersSchema.safeParse(
    (Array.isArray(template?.questions) ? template.questions : []).map((q) => ({ ...(q as object), answer: null, text: null })),
  );
  if (!template || !questions.success) return { state: "invalid" };
  return {
    state: "ok",
    requestId: req.id,
    purpose: "anamnesis",
    clinicName: clinic?.name ?? "",
    expiresAt: req.expires_at,
    document: null,
    anamnesis: { templateId: template.id, questions: questions.data },
  };
}

export type SignInput = {
  token: string;
  signerName: string;
  signaturePng: Uint8Array;
  ip: string;
  userAgent: string;
  answers?: Answer[];
};

const anamnesisStyles = StyleSheet.create({
  page: { padding: 48, fontSize: 10, fontFamily: "Helvetica", lineHeight: 1.4 },
  title: { fontSize: 15, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb", paddingVertical: 4 },
});

async function renderAnamnesisPdf(clinicName: string, patientName: string, answers: Answer[]) {
  const rows = answers.map((a, i) =>
    h(View, { key: i, style: anamnesisStyles.row, wrap: false }, [
      h(Text, { key: "q", style: { width: "60%", color: "#4b5563" } }, a.label),
      h(Text, { key: "a", style: { width: "40%" } }, a.type === "text" ? a.text || "—" : a.answer === "yes" ? `Sim${a.text ? ` — ${a.text}` : ""}` : a.answer === "no" ? "Não" : "—"),
    ]),
  );
  const doc = h(Document, { title: `Anamnese - ${patientName}` }, [
    h(Page, { key: "p", size: "A4", style: anamnesisStyles.page }, [
      h(Text, { key: "t", style: anamnesisStyles.title }, "Anamnese preenchida pelo paciente"),
      h(Text, { key: "c", style: { color: "#6b7280", marginBottom: 16 } }, `${clinicName} · ${patientName}`),
      ...rows,
    ]),
  ]);
  return renderToBuffer(doc);
}

async function markRequestSigned(admin: Admin, requestId: string, values: Record<string, unknown>) {
  // Uso único: só um envio consegue trocar "pending" por "signed".
  const { data } = await admin
    .from("signature_requests")
    .update({ status: "signed", ...values })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("id");
  return Boolean(data?.length);
}

/** Registra a assinatura do paciente. Devolve uma mensagem de erro ou null. */
export async function completeSignature(input: SignInput): Promise<string | null> {
  if (!isWellFormedToken(input.token)) return "Link inválido.";
  if (input.signaturePng.byteLength > SIGNATURE_MAX_BYTES) return "A assinatura ficou grande demais. Tente de novo.";
  const admin = createAdminClient();
  const { data: req } = await admin
    .from("signature_requests")
    .select("id, clinic_id, patient_id, purpose, document_id, anamnesis_template_id, status, expires_at")
    .eq("token_hash", sha256Hex(input.token))
    .maybeSingle();
  if (!req || req.status !== "pending") return "Este link não está mais disponível.";
  if (new Date(req.expires_at) <= new Date()) return "Este link expirou. Peça um novo à clínica.";

  const [{ data: clinic }, { data: patient }] = await Promise.all([
    admin.from("clinics").select("name").eq("id", req.clinic_id).single(),
    admin.from("patients").select("full_name").eq("id", req.patient_id).single(),
  ]);
  const signedAt = new Date();
  const base = `${req.clinic_id}/documents/${req.patient_id}`;
  const signaturePath = `${base}/${req.id}-assinatura.png`;

  let original: Uint8Array;
  let documentTitle: string;
  let documentCode: string;
  let anamnesisId: string | null = null;

  if (req.purpose === "document") {
    const { data: doc } = await admin.from("patient_documents").select("id, title, status, pdf_path, pdf_sha256").eq("id", req.document_id!).single();
    if (!doc || doc.status !== "issued" || !doc.pdf_path || !doc.pdf_sha256) return "Este documento não está mais disponível.";
    const { data: file } = await admin.storage.from("clinic").download(doc.pdf_path);
    if (!file) return "Não foi possível abrir o documento. Tente de novo.";
    original = new Uint8Array(await file.arrayBuffer());
    // O arquivo guardado precisa ser exatamente o que foi emitido.
    if (sha256Hex(original) !== doc.pdf_sha256) return "O documento foi alterado depois de emitido e não pode ser assinado. Avise a clínica.";
    documentTitle = doc.title;
    documentCode = doc.id.slice(0, 8).toUpperCase();
  } else {
    const parsed = answersSchema.safeParse(input.answers);
    if (!parsed.success) return "Responda as perguntas da anamnese.";
    const missing = parsed.data.find((a) => a.type === "yes_no" && !a.answer);
    if (missing) return `Responda: “${missing.label}”.`;
    const { data: anamnesis, error } = await admin
      .from("anamneses")
      .insert({ clinic_id: req.clinic_id, patient_id: req.patient_id, template_id: req.anamnesis_template_id, answers: parsed.data, signed_at: signedAt.toISOString() })
      .select("id")
      .single();
    if (error || !anamnesis) return "Não foi possível salvar a anamnese. Tente de novo.";
    anamnesisId = anamnesis.id;
    original = new Uint8Array(await renderAnamnesisPdf(clinic?.name ?? "", patient?.full_name ?? "", parsed.data));
    documentTitle = "Anamnese";
    documentCode = anamnesis.id.slice(0, 8).toUpperCase();
  }

  const originalSha256 = sha256Hex(original);
  const signed = await appendEvidencePage(original, {
    documentTitle,
    documentCode,
    clinicName: clinic?.name ?? "",
    signerName: input.signerName,
    signedAt: `${formatDateTime(signedAt)} (${signedAt.toISOString()})`,
    ip: input.ip,
    userAgent: input.userAgent,
    originalSha256,
    signaturePng: input.signaturePng,
  });
  const signedSha256 = sha256Hex(signed);
  const signedPath = `${base}/${req.purpose === "document" ? req.document_id : anamnesisId}-assinado-${randomUUID().slice(0, 8)}.pdf`;

  const uploads = await Promise.all([
    admin.storage.from("clinic").upload(signaturePath, input.signaturePng, { contentType: "image/png", upsert: false }),
    admin.storage.from("clinic").upload(signedPath, signed, { contentType: "application/pdf", upsert: false }),
  ]);
  if (uploads.some((u) => u.error)) return "Não foi possível guardar a assinatura. Tente de novo.";

  const ok = await markRequestSigned(admin, req.id, {
    signed_at: signedAt.toISOString(),
    signer_name: input.signerName,
    signer_ip: input.ip.slice(0, 100),
    signer_user_agent: input.userAgent.slice(0, 500),
    signature_path: signaturePath,
    original_sha256: originalSha256,
    signed_pdf_path: signedPath,
    signed_sha256: signedSha256,
    anamnesis_id: anamnesisId,
  });
  if (!ok) {
    await admin.storage.from("clinic").remove([signaturePath, signedPath]);
    return "Este link já foi usado.";
  }
  if (req.purpose === "document") {
    await admin.from("patient_documents").update({ status: "signed" }).eq("id", req.document_id!);
  }
  return null;
}
