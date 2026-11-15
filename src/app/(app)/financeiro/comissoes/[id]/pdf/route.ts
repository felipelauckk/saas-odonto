import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Demonstrativo de comissão: a RLS decide (gestão ou o próprio profissional). */
export async function GET(_request: Request, { params }: RouteContext<"/financeiro/comissoes/[id]/pdf">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new NextResponse("Inválido.", { status: 400 });
  const supabase = await createClient();
  const { data } = await supabase.from("commission_closings").select("pdf_path").eq("id", id).maybeSingle();
  if (!data?.pdf_path) return new NextResponse("Demonstrativo não encontrado.", { status: 404 });
  const { data: signed } = await createAdminClient().storage.from("clinic").createSignedUrl(data.pdf_path, 120);
  return signed ? NextResponse.redirect(signed.signedUrl) : new NextResponse("Indisponível.", { status: 404 });
}
