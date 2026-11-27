import { NextResponse } from "next/server";
import { z } from "zod";

import { statusLabels } from "@/features/agenda/labels";
import { getAgendaData } from "@/features/agenda/queries";
import { getClinicLetterhead } from "@/features/plans/queries";
import { getSessionContext } from "@/features/tenancy/queries";
import { todayIso } from "@/lib/dates";
import { formatPhone } from "@/lib/documents";
import { pdfResponse, renderReportPdf, type PdfBlock } from "@/lib/pdf/report-pdf";
import { addDays, formatLongDate, startOfWeek } from "@/lib/timezone";

const paramsSchema = z.object({
  data: z.iso.date().catch(() => todayIso()),
  visao: z.enum(["dia", "semana"]).catch("dia"),
  telefones: z.enum(["0", "1"]).catch("1"),
  ocultar: z.string().max(4000).optional(),
});

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const br = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");

/**
 * Agenda do dia (ou da semana) em PDF, por profissional: horário, paciente,
 * celular (opcional), procedimentos, situação e observação, com os compromissos.
 */
export async function GET(request: Request) {
  const session = await getSessionContext();
  if (!session?.clinic || !session.activeUnit) return new NextResponse("Sessão expirada.", { status: 401 });
  const p = paramsSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const week = p.visao === "semana";
  const from = week ? startOfWeek(p.data) : p.data;
  const days = week ? 7 : 1;
  const hidden = new Set((p.ocultar ?? "").split(",").filter(Boolean));
  const showPhones = p.telefones === "1";

  const [data, letterhead] = await Promise.all([
    getAgendaData({ unitId: session.activeUnit.id, from, days, isDentist: session.clinic.role === "dentist" }),
    getClinicLetterhead(),
  ]);
  if (!letterhead) return new NextResponse("Clínica não encontrada.", { status: 404 });

  const blocks: PdfBlock[] = [];
  const general = data.blocks.filter((b) => !b.professionalId);
  if (general.length) {
    blocks.push({
      kind: "table",
      title: "Toda a clínica",
      columns: [{ label: "Data", flex: 0.7 }, { label: "Horário", flex: 1 }, { label: "Compromisso", flex: 4 }],
      rows: general.map((b) => [br(b.date), b.allDay ? "Dia inteiro" : `${hhmm(b.startMin)}–${hhmm(b.endMin)}`, [b.title, b.notes].filter(Boolean).join(" · ")]),
    });
  }

  for (const pro of data.professionals.filter((x) => !hidden.has(x.id))) {
    const rows = [
      ...data.appointments
        .filter((a) => a.professionalId === pro.id)
        .map((a) => ({
          date: a.date,
          start: a.startMin,
          cells: [
            br(a.date),
            `${hhmm(a.startMin)}–${hhmm(a.endMin)}`,
            a.patientName,
            ...(showPhones ? [a.patientPhone ? formatPhone(a.patientPhone) : ""] : []),
            a.procedures.length ? a.procedures.map((x) => x.name).join(", ") : (a.type ?? ""),
            statusLabels[a.status],
            a.notes ?? "",
          ],
        })),
      ...data.blocks
        .filter((b) => b.professionalId === pro.id)
        .map((b) => ({
          date: b.date,
          start: b.allDay ? -1 : b.startMin,
          cells: [
            br(b.date),
            b.allDay ? "Dia inteiro" : `${hhmm(b.startMin)}–${hhmm(b.endMin)}`,
            `Compromisso: ${b.title}`,
            ...(showPhones ? [""] : []),
            "",
            b.kind === "block" ? "Bloqueado" : "Lembrete",
            b.notes ?? "",
          ],
        })),
    ].sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
    if (!rows.length) continue;
    blocks.push({
      kind: "table",
      title: `${pro.name} · ${rows.filter((r) => !r.cells[2]!.startsWith("Compromisso:")).length} pacientes`,
      columns: [
        { label: "Data", flex: 0.7 },
        { label: "Horário", flex: 1 },
        { label: "Paciente", flex: 2 },
        ...(showPhones ? [{ label: "Celular", flex: 1.3 }] : []),
        { label: "Procedimentos", flex: 2 },
        { label: "Situação", flex: 1.1 },
        { label: "Observação", flex: 1.8 },
      ],
      rows: rows.map((r) => r.cells),
    });
  }
  if (!blocks.length) blocks.push({ kind: "table", columns: [{ label: "Agenda" }], rows: [], empty: "Nenhuma consulta nem compromisso no período." });

  const title = week ? `Agenda da semana · ${br(from)} a ${br(addDays(from, 6))}` : `Agenda · ${formatLongDate(p.data)}`;
  const pdf = await renderReportPdf({ letterhead, title, subtitle: session.activeUnit.name, blocks, landscape: true });
  return pdfResponse(pdf, `agenda-${from}${week ? "-semana" : ""}.pdf`);
}
