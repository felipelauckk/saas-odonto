/**
 * Documentos e assinatura eletrônica: permissões por tipo, documento imutável,
 * link que expira, de uso único e que só mostra aquele documento, e hash que
 * detecta qualquer alteração no PDF.
 */
import { crc32, deflateSync } from "node:zlib";

import { PDFDocument } from "pdf-lib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { sha256Hex } from "@/lib/hash";
import { createTestEnv, hasSupabase, type Client } from "@/test/supabase";

import { completeSignature, createSignatureRequest, loadPublicSigning } from "./signing";

/** PNG válido (retângulo com traço) para simular a assinatura desenhada. */
function makePng(width = 300, height = 100) {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bits
  ihdr[9] = 2; // RGB
  const rows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3, 255);
    for (let x = 0; x < width; x++) if (Math.abs(y - height / 2 - 20 * Math.sin(x / 20)) < 2) row.fill(0, 1 + x * 3, 4 + x * 3);
    rows.push(row);
  }
  return new Uint8Array(
    Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(Buffer.concat(rows))), chunk("IEND", Buffer.alloc(0))]),
  );
}

describe.skipIf(!hasSupabase)("documentos e assinatura eletrônica", () => {
  const env = createTestEnv("documentos");
  const admin = env.admin;

  let dentist: Client;
  let reception: Client;
  let other: Client;
  let clinicId = "";
  let patientId = "";
  let drAna = "";
  let dentistUserId = "";

  async function issuedDocument(client: Client, kind: "contract" | "prescription" = "contract") {
    const { data: doc, error } = await client
      .from("patient_documents")
      .insert({
        clinic_id: clinicId,
        patient_id: patientId,
        kind,
        title: kind === "contract" ? "Contrato de teste" : "Receita de teste",
        body: "Texto do documento de teste.",
        professional_id: kind === "prescription" ? drAna : null,
        prescription: kind === "prescription" ? [{ name: "Ibuprofeno", presentation: "600 mg", dosage: "1 a cada 8h", quantity: "9" }] : null,
      })
      .select("id")
      .single();
    if (error) throw error;
    // PDF de verdade, guardado como o servidor faz ao emitir.
    const pdf = await PDFDocument.create();
    pdf.addPage().drawText("Documento original");
    const bytes = await pdf.save();
    const path = `${clinicId}/documents/${patientId}/${doc.id}.pdf`;
    await admin.storage.from("clinic").upload(path, bytes, { contentType: "application/pdf" });
    await admin.from("patient_documents").update({ pdf_path: path, pdf_sha256: sha256Hex(bytes) }).eq("id", doc.id);
    return { id: doc.id, path, bytes };
  }

  beforeAll(async () => {
    const owner = await env.createUser("owner", "Clínica Documentos");
    await env.createUser("outra", "Clínica Outra Documentos");
    const dentistUser = await env.createUser("dentista");
    const receptionUser = await env.createUser("recepcao");
    clinicId = owner.clinicId!;
    dentistUserId = dentistUser.userId;
    const dentistMember = await env.addMember(clinicId, dentistUser.userId, "dentist");
    await env.addMember(clinicId, receptionUser.userId, "receptionist");
    const { data: pro } = await admin.from("professionals").insert({ clinic_id: clinicId, name: "Dra. Ana", cro: "SP-1", member_id: dentistMember }).select("id").single();
    drAna = pro!.id;
    const { data: patient } = await admin.from("patients").insert({ clinic_id: clinicId, full_name: "Paciente Documentos", cpf: "52998224725" }).select("id").single();
    patientId = patient!.id;
    dentist = await env.signIn("dentista");
    reception = await env.signIn("recepcao");
    other = await env.signIn("outra");
  });

  afterAll(async () => {
    await env.cleanup();
  });

  it("clínica nova recebe modelos e medicamentos padrão", async () => {
    const { data: templates } = await dentist.from("document_templates").select("kind");
    expect(new Set(templates?.map((t) => t.kind))).toEqual(
      new Set(["prescription", "special_prescription", "certificate", "attendance", "contract", "consent", "post_op"]),
    );
    const { data: meds } = await dentist.from("medications").select("name, special_control");
    expect(meds!.length).toBeGreaterThanOrEqual(20);
    expect(meds!.find((m) => m.name === "Amoxicilina")?.special_control).toBe(true);
  });

  it("recepção emite contrato, mas não receita, e não vê receitas", async () => {
    await issuedDocument(reception, "contract");
    const { error } = await reception.from("patient_documents").insert({
      clinic_id: clinicId,
      patient_id: patientId,
      kind: "prescription",
      title: "Receita",
      body: "x",
      professional_id: drAna,
    });
    expect(error).not.toBeNull();

    await issuedDocument(dentist, "prescription");
    const { data: seen } = await reception.from("patient_documents").select("kind");
    expect(seen?.map((d) => d.kind)).toEqual(["contract"]);
    const { data: dentistSees } = await dentist.from("patient_documents").select("kind");
    expect(dentistSees!.length).toBe(2);
  });

  it("documento emitido não se edita, e só a assinatura marca como assinado", async () => {
    const doc = await issuedDocument(dentist);
    const { error: edit } = await dentist.from("patient_documents").update({ body: "alterado" } as never).eq("id", doc.id);
    expect(edit).not.toBeNull();
    const { error: fakeSign } = await dentist.from("patient_documents").update({ status: "signed" }).eq("id", doc.id);
    expect(fakeSign).not.toBeNull();
  });

  it("o hash do link não é legível e ninguém de fora lê nada", async () => {
    const doc = await issuedDocument(dentist);
    await createSignatureRequest({ clinicId, patientId, documentId: doc.id, days: 7, createdBy: dentistUserId });
    const { error } = await dentist.from("signature_requests").select("token_hash");
    expect(error).not.toBeNull();
    for (const table of ["patient_documents", "signature_requests", "document_templates", "medications"] as const) {
      const { data } = await other.from(table).select("id").eq("clinic_id", clinicId);
      expect(data).toEqual([]);
    }
  });

  it("assinatura: página mostra só o documento; uso único; hash detecta alteração", async () => {
    const doc = await issuedDocument(dentist);
    const { token } = await createSignatureRequest({ clinicId, patientId, documentId: doc.id, days: 7, createdBy: dentistUserId });

    const view = await loadPublicSigning(token);
    expect(view.state).toBe("ok");
    if (view.state !== "ok") return;
    expect(Object.keys(view).sort()).toEqual(["anamnesis", "clinicName", "document", "expiresAt", "purpose", "requestId", "state"]);
    expect(Object.keys(view.document!).sort()).toEqual(["body", "title"]);
    expect(JSON.stringify(view)).not.toContain("52998224725");

    const error = await completeSignature({ token, signerName: "Paciente Documentos", signaturePng: makePng(), ip: "203.0.113.7", userAgent: "Teste/1.0" });
    expect(error).toBeNull();

    const { data: req } = await admin.from("signature_requests").select("*").eq("document_id", doc.id).eq("status", "signed").single();
    expect(req!.original_sha256).toBe(sha256Hex(doc.bytes));
    expect(req!.signer_ip).toBe("203.0.113.7");
    const { data: docRow } = await admin.from("patient_documents").select("status").eq("id", doc.id).single();
    expect(docRow!.status).toBe("signed");

    const { data: file } = await admin.storage.from("clinic").download(req!.signed_pdf_path!);
    const signed = new Uint8Array(await file!.arrayBuffer());
    expect(sha256Hex(signed)).toBe(req!.signed_sha256);
    // Páginas originais preservadas + página de evidências.
    expect((await PDFDocument.load(signed)).getPageCount()).toBe(2);
    // Um único byte alterado já não confere.
    const tampered = Uint8Array.from(signed);
    const at = tampered.length - 20;
    tampered[at] = (tampered[at] ?? 0) ^ 1;
    expect(sha256Hex(tampered)).not.toBe(req!.signed_sha256);

    // Uso único e documento assinado imutável.
    expect(await completeSignature({ token, signerName: "Outra pessoa", signaturePng: makePng(), ip: "1.1.1.1", userAgent: "x" })).not.toBeNull();
    expect((await loadPublicSigning(token)).state).toBe("used");
    const { error: cancel } = await dentist.from("patient_documents").update({ status: "canceled" }).eq("id", doc.id);
    expect(cancel).not.toBeNull();
  });

  it("link expirado, token errado e PDF alterado no armazenamento são recusados", async () => {
    const doc = await issuedDocument(dentist);
    const { token } = await createSignatureRequest({ clinicId, patientId, documentId: doc.id, days: 1, createdBy: dentistUserId });

    expect((await loadPublicSigning("x".repeat(43))).state).toBe("invalid");
    expect((await loadPublicSigning("curto")).state).toBe("invalid");

    await admin.from("signature_requests").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("document_id", doc.id).eq("status", "pending");
    expect((await loadPublicSigning(token)).state).toBe("expired");
    expect(await completeSignature({ token, signerName: "Paciente", signaturePng: makePng(), ip: "1.1.1.1", userAgent: "x" })).toMatch(/expirou/);

    const { token: fresh } = await createSignatureRequest({ clinicId, patientId, documentId: doc.id, days: 1, createdBy: dentistUserId });
    await admin.storage.from("clinic").update(doc.path, new Uint8Array([...doc.bytes, 32]), { contentType: "application/pdf", upsert: true });
    expect(await completeSignature({ token: fresh, signerName: "Paciente", signaturePng: makePng(), ip: "1.1.1.1", userAgent: "x" })).toMatch(/alterado/);
  });

  it("anamnese por link vira nova versão assinada pelo paciente", async () => {
    const { data: template } = await admin.from("anamnesis_templates").select("id, questions").eq("clinic_id", clinicId).single();
    const { token } = await createSignatureRequest({ clinicId, patientId, anamnesisTemplateId: template!.id, days: 3, createdBy: dentistUserId });
    const view = await loadPublicSigning(token);
    if (view.state !== "ok") throw new Error(view.state);
    const answers = view.anamnesis!.questions.map((q) => ({ ...q, answer: q.type === "yes_no" ? ("no" as const) : null }));
    const error = await completeSignature({ token, signerName: "Paciente Documentos", signaturePng: makePng(), ip: "1.1.1.1", userAgent: "x", answers });
    expect(error).toBeNull();
    const { data: versions } = await dentist.from("anamneses").select("filled_by, signed_at").eq("patient_id", patientId);
    expect(versions).toHaveLength(1);
    expect(versions![0]!.filled_by).toBeNull();
    expect(versions![0]!.signed_at).not.toBeNull();
  });
});
