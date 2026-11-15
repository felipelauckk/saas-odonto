import { NextResponse } from "next/server";

import { logAccess } from "@/features/audit/log";
import { reportBySlug } from "@/features/reports/catalog";
import { parseReportFilters } from "@/features/reports/filters";
import { toSheet } from "@/features/reports/format";
import { runReport } from "@/features/reports/run";
import { canManageClinic } from "@/features/tenancy/roles";
import { getSessionContext } from "@/features/tenancy/queries";
import { todayIso } from "@/lib/dates";
import { toCsv, toXlsx } from "@/lib/spreadsheet";

/** Exporta o relatório com os mesmos filtros da tela (Excel ou CSV). */
export async function GET(request: Request, { params }: RouteContext<"/relatorios/[slug]/exportar">) {
  const session = await getSessionContext();
  if (!session?.clinic || !canManageClinic(session.clinic.role)) return new NextResponse("Sem permissão.", { status: 403 });
  const { slug } = await params;
  const def = reportBySlug.get(slug);
  if (!def) return new NextResponse("Relatório não encontrado.", { status: 404 });

  const url = new URL(request.url);
  const filters = parseReportFilters(def, Object.fromEntries(url.searchParams), todayIso());
  const result = await runReport(slug, filters);
  if (!result) return new NextResponse("Relatório não encontrado.", { status: 404 });
  if (def.personalData) await logAccess("export", "patients", null);

  const sheet = toSheet(def.title, result);
  const base = `${slug}-${filters.from}-a-${filters.to}`;
  const headers = { "Cache-Control": "no-store" };
  if (url.searchParams.get("formato") === "csv") {
    return new NextResponse(toCsv(sheet), { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${base}.csv"` } });
  }
  return new NextResponse(new Uint8Array(toXlsx(sheet)), {
    headers: { ...headers, "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${base}.xlsx"` },
  });
}
