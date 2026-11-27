import { NextResponse } from "next/server";
import { z } from "zod";

import { patientAppointmentsSheet } from "@/features/agenda/patient-appointments-export";
import { logAccess } from "@/features/audit/log";
import { getPatient } from "@/features/patients/queries";
import { toCsv, toXlsx } from "@/lib/spreadsheet";

/** Consultas do paciente em Excel (padrão) ou CSV (?formato=csv), com o gerador dos relatórios. */
export async function GET(request: Request, { params }: RouteContext<"/pacientes/[id]/agendamentos/exportar">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new NextResponse("Paciente inválido.", { status: 400 });
  const patient = await getPatient(id);
  if (!patient) return new NextResponse("Paciente não encontrado.", { status: 404 });
  const sheet = await patientAppointmentsSheet(id, patient.full_name);
  await logAccess("export", "patients", id, id);
  const base = `agendamentos-${id.slice(0, 8)}`;
  const headers = { "Cache-Control": "private, no-store" };
  if (new URL(request.url).searchParams.get("formato") === "csv") {
    return new NextResponse(toCsv(sheet), { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${base}.csv"` } });
  }
  return new NextResponse(new Uint8Array(toXlsx(sheet)), {
    headers: { ...headers, "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${base}.xlsx"` },
  });
}
