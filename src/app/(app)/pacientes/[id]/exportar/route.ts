import { NextResponse } from "next/server";
import { z } from "zod";

import { logAccess } from "@/features/audit/log";
import { getClinicalAccess } from "@/features/clinical/queries";
import { renderPatientExport } from "@/features/patients/export-pdf";
import { getSessionContext } from "@/features/tenancy/queries";

/** PDF com todos os dados do paciente (LGPD). Só quem lê o prontuário exporta. */
export async function GET(_request: Request, { params }: RouteContext<"/pacientes/[id]/exportar">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new NextResponse("Paciente inválido.", { status: 400 });
  const [session, access] = await Promise.all([getSessionContext(), getClinicalAccess()]);
  if (!session?.clinic) return new NextResponse("Sessão expirada.", { status: 401 });
  if (!access.canRead) return new NextResponse("Sem permissão para exportar o prontuário.", { status: 403 });

  const pdf = await renderPatientExport(id, session.clinic.name);
  if (!pdf) return new NextResponse("Paciente não encontrado.", { status: 404 });
  await logAccess("export", "patients", id, id);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="dados-paciente-${id.slice(0, 8)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
