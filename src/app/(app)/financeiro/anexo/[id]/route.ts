import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

/** Comprovante de uma conta a pagar (a RLS e a política do Storage só deixam a gestão). */
export async function GET(_request: Request, { params }: RouteContext<"/financeiro/anexo/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new NextResponse("Conta inválida.", { status: 400 });
  const supabase = await createClient();
  const { data } = await supabase.from("payables").select("attachment_path").eq("id", id).maybeSingle();
  if (!data?.attachment_path) return new NextResponse("Comprovante não encontrado.", { status: 404 });
  const { data: signed } = await supabase.storage.from("clinic").createSignedUrl(data.attachment_path, 120);
  if (!signed) return new NextResponse("Comprovante indisponível.", { status: 404 });
  return NextResponse.redirect(signed.signedUrl);
}
