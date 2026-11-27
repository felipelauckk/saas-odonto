import { NextResponse } from "next/server";
import { z } from "zod";

import { patientAppointmentRows } from "@/features/agenda/patient-appointments-export";
import { getPatient } from "@/features/patients/queries";
import { getClinicLetterhead } from "@/features/plans/queries";
import { pdfResponse, renderReportPdf } from "@/lib/pdf/report-pdf";

/** Consultas do paciente em PDF. */
export async function GET(_request: Request, { params }: RouteContext<"/pacientes/[id]/agendamentos/imprimir">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new NextResponse("Paciente inválido.", { status: 400 });
  const [patient, letterhead, rows] = await Promise.all([getPatient(id), getClinicLetterhead(), patientAppointmentRows(id)]);
  if (!patient || !letterhead) return new NextResponse("Paciente não encontrado.", { status: 404 });
  const pdf = await renderReportPdf({
    letterhead,
    title: "Agendamentos",
    subtitle: patient.full_name,
    blocks: [
      {
        kind: "table",
        columns: [{ label: "Data", flex: 1.1 }, { label: "Horário", flex: 1 }, { label: "Profissional", flex: 1.6 }, { label: "Tipo", flex: 1.4 }, { label: "Unidade", flex: 1.2 }, { label: "Situação", flex: 1 }],
        rows: rows.map((r) => [r.date, r.time, r.professional, r.type, r.unit, r.status]),
        empty: "Nenhuma consulta.",
      },
    ],
  });
  return pdfResponse(pdf, `agendamentos-${id.slice(0, 8)}.pdf`);
}
