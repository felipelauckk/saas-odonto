import { NextResponse } from "next/server";
import { z } from "zod";

import { logAccess } from "@/features/audit/log";
import { renderOdontogramPdf } from "@/features/clinical/odontogram-pdf";
import { getClinicalAccess, getToothRecords } from "@/features/clinical/queries";
import { getPatient } from "@/features/patients/queries";
import { getClinicLetterhead } from "@/features/plans/queries";
import { pdfResponse } from "@/lib/pdf/report-pdf";
import { utcToZoned } from "@/lib/timezone";
import { createClient } from "@/lib/supabase/server";

/** Odontograma em PDF (desenho e procedimentos). Só quem lê o prontuário. */
export async function GET(_request: Request, { params }: RouteContext<"/pacientes/[id]/odontograma/imprimir">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new NextResponse("Paciente inválido.", { status: 400 });
  const access = await getClinicalAccess();
  if (!access.canRead) return new NextResponse("Sem permissão para ver o prontuário.", { status: 403 });
  const supabase = await createClient();
  const [patient, letterhead, records, { data: items }] = await Promise.all([
    getPatient(id),
    getClinicLetterhead(),
    getToothRecords(id),
    supabase
      .from("treatment_items")
      .select("description, tooth, faces, status, done_at, sessions_planned, position, plan_item_sessions(done_at), treatment_plans!inner(patient_id, status, approved_at)")
      .eq("treatment_plans.patient_id", id)
      .in("treatment_plans.status", ["approved", "partially_approved", "completed"])
      .in("status", ["approved", "done"]),
  ]);
  if (!patient || !letterhead) return new NextResponse("Paciente não encontrado.", { status: 404 });
  await logAccess("export", "tooth_records", id);
  const rows = (items ?? [])
    .map((i) => ({
      date: i.done_at ? utcToZoned(i.done_at).date : i.treatment_plans.approved_at ? utcToZoned(i.treatment_plans.approved_at).date : null,
      tooth: i.tooth,
      faces: i.faces,
      description: i.description,
      sessionsPlanned: i.sessions_planned,
      sessionsDone: i.plan_item_sessions.filter((s) => s.done_at).length,
      status: i.status,
    }))
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  const pdf = await renderOdontogramPdf({ letterhead, patientName: patient.full_name, records, items: rows });
  return pdfResponse(pdf, `odontograma-${id.slice(0, 8)}.pdf`);
}
