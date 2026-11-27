import { NextResponse } from "next/server";
import { z } from "zod";

import { renderPatientDataPdf } from "@/features/patients/print-pdf";
import { getPatient } from "@/features/patients/queries";
import { getClinicLetterhead } from "@/features/plans/queries";
import { pdfResponse } from "@/lib/pdf/report-pdf";

/** "Imprimir dados": o cadastro do paciente em PDF (sem prontuário). */
export async function GET(_request: Request, { params }: RouteContext<"/pacientes/[id]/imprimir">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new NextResponse("Paciente inválido.", { status: 400 });
  const [patient, letterhead] = await Promise.all([getPatient(id), getClinicLetterhead()]);
  if (!patient || !letterhead) return new NextResponse("Paciente não encontrado.", { status: 404 });
  return pdfResponse(await renderPatientDataPdf(patient, letterhead), `cadastro-${id.slice(0, 8)}.pdf`);
}
