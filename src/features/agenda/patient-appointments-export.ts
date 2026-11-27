import "server-only";

import { formatLongDate, utcToZoned } from "@/lib/timezone";
import type { Sheet } from "@/lib/spreadsheet";

import { statusLabels } from "./labels";
import { listPatientAppointments } from "./queries";

/** Linhas das consultas do paciente (planilha e PDF usam as mesmas). */
export async function patientAppointmentRows(patientId: string) {
  const appts = await listPatientAppointments(patientId);
  return appts.map((a) => {
    const start = utcToZoned(a.starts_at);
    const end = utcToZoned(a.ends_at);
    return {
      date: start.date.split("-").reverse().join("/"),
      longDate: formatLongDate(start.date),
      time: `${start.time}–${end.time}`,
      professional: a.professionals?.name ?? "",
      type: a.type ?? "",
      unit: a.units?.name ?? "",
      status: statusLabels[a.status],
    };
  });
}

export async function patientAppointmentsSheet(patientId: string, patientName: string): Promise<Sheet> {
  const rows = await patientAppointmentRows(patientId);
  return {
    name: `Agendamentos - ${patientName}`.slice(0, 31),
    header: ["Data", "Horário", "Profissional", "Tipo", "Unidade", "Situação"],
    rows: rows.map((r) => [r.date, r.time, r.professional, r.type, r.unit, r.status]),
  };
}

