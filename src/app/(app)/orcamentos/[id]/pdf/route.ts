import { NextResponse } from "next/server";
import { z } from "zod";

import { renderPlanPdf } from "@/features/plans/plan-pdf";
import { getClinicLetterhead, getPlan } from "@/features/plans/queries";

export async function GET(_request: Request, { params }: RouteContext<"/orcamentos/[id]/pdf">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new NextResponse("Orçamento inválido.", { status: 400 });

  // As consultas usam a sessão do usuário: a RLS decide se ele pode ver o orçamento.
  const [detail, letterhead] = await Promise.all([getPlan(id), getClinicLetterhead()]);
  if (!detail || !letterhead) return new NextResponse("Orçamento não encontrado.", { status: 404 });

  const pdf = await renderPlanPdf(detail, letterhead);
  const name = (detail.plan.patients?.full_name ?? "paciente").normalize("NFD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").toLowerCase();
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="orcamento-${name}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
