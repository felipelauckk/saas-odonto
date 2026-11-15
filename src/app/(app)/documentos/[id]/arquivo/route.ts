import { NextResponse } from "next/server";
import { z } from "zod";

import { logAccess } from "@/features/audit/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * PDF de um documento (?versao=assinado para a via com evidências). A RLS decide
 * se o usuário enxerga o documento; só então o servidor gera um link de 2 minutos.
 */
export async function GET(request: Request, { params }: RouteContext<"/documentos/[id]/arquivo">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new NextResponse("Documento inválido.", { status: 400 });
  const signedVersion = new URL(request.url).searchParams.get("versao") === "assinado";
  const supabase = await createClient();

  let path: string | null = null;
  let patientId: string | null = null;
  if (signedVersion) {
    // id = pedido de assinatura (documento ou anamnese)
    const { data: req } = await supabase.from("signature_requests").select("id, patient_id, status, purpose, document_id").eq("id", id).maybeSingle();
    if (!req || req.status !== "signed") return new NextResponse("Assinatura não encontrada.", { status: 404 });
    if (req.purpose === "anamnesis") {
      const { data: canRead } = await supabase.rpc("can_read_clinical");
      if (!canRead) return new NextResponse("Sem permissão.", { status: 403 });
    }
    const { data: full } = await createAdminClient().from("signature_requests").select("signed_pdf_path").eq("id", id).single();
    path = full?.signed_pdf_path ?? null;
    patientId = req.patient_id;
  } else {
    const { data: doc } = await supabase.from("patient_documents").select("pdf_path, patient_id").eq("id", id).maybeSingle();
    if (!doc) return new NextResponse("Documento não encontrado.", { status: 404 });
    path = doc.pdf_path;
    patientId = doc.patient_id;
  }
  if (!path) return new NextResponse("Arquivo indisponível.", { status: 404 });

  const { data: signed } = await createAdminClient().storage.from("clinic").createSignedUrl(path, 120);
  if (!signed) return new NextResponse("Arquivo indisponível.", { status: 404 });
  await logAccess("view", "patients", patientId, id);
  return NextResponse.redirect(signed.signedUrl);
}
