import { NextResponse } from "next/server";
import { z } from "zod";

import { getReceipt } from "@/features/finance/queries";
import { renderReceiptPdf } from "@/features/finance/receipt-pdf";
import { getClinicLetterhead } from "@/features/plans/queries";

export async function GET(_request: Request, { params }: RouteContext<"/financeiro/recibo/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new NextResponse("Recibo inválido.", { status: 400 });
  const [receipt, letterhead] = await Promise.all([getReceipt(id), getClinicLetterhead()]);
  if (!receipt || !letterhead) return new NextResponse("Recibo não encontrado.", { status: 404 });
  if (receipt.status !== "paid" || !receipt.paid_at || !receipt.paid_amount_cents) {
    return new NextResponse("Esta conta ainda não foi paga.", { status: 409 });
  }
  const pdf = await renderReceiptPdf({ ...receipt, paid_at: receipt.paid_at, paid_amount_cents: receipt.paid_amount_cents }, letterhead);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="recibo-${id.slice(0, 8)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
