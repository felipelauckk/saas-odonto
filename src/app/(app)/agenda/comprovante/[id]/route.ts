import { NextResponse } from "next/server";
import { z } from "zod";

import { renderAppointmentProofPdf } from "@/features/agenda/appointment-pdf";
import { getClinicLetterhead } from "@/features/plans/queries";
import { createClient } from "@/lib/supabase/server";
import { formatLongDate, utcToZoned } from "@/lib/timezone";

type Address = { street?: string; number?: string; complement?: string; district?: string; city?: string; state?: string };

function addressText(a: unknown): string | null {
  if (!a) return null;
  if (typeof a === "string") return a;
  const x = a as Address;
  return [[x.street, x.number].filter(Boolean).join(", "), x.complement, x.district, [x.city, x.state].filter(Boolean).join("/")].filter(Boolean).join(" · ") || null;
}

/** Comprovante de agendamento em PDF (lido com a sessão do usuário: a RLS decide quem vê). */
export async function GET(_request: Request, { params }: RouteContext<"/agenda/comprovante/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new NextResponse("Agendamento inválido.", { status: 400 });
  const supabase = await createClient();
  const [{ data: a }, letterhead] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, starts_at, ends_at, status, patients(full_name), professionals(name), units(name, address, phone), appointment_procedures(position, description, procedures(name))")
      .eq("id", id)
      .maybeSingle(),
    getClinicLetterhead(),
  ]);
  if (!a || !letterhead) return new NextResponse("Agendamento não encontrado.", { status: 404 });
  if (a.status === "canceled") return new NextResponse("Esta consulta foi desmarcada.", { status: 409 });
  const start = utcToZoned(a.starts_at);
  const end = utcToZoned(a.ends_at);
  const pdf = await renderAppointmentProofPdf(
    {
      id: a.id,
      patientName: a.patients?.full_name ?? "Paciente",
      dateText: formatLongDate(start.date).replace(/^./, (c) => c.toUpperCase()),
      timeText: `${start.time} às ${end.time}`,
      professionalName: a.professionals?.name ?? "",
      unitName: a.units?.name ?? "",
      unitAddress: addressText(a.units?.address),
      unitPhone: a.units?.phone ?? null,
      procedures: [...a.appointment_procedures].sort((x, y) => x.position - y.position).map((p) => p.description ?? p.procedures?.name ?? "Procedimento"),
    },
    letterhead,
  );
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="agendamento-${id.slice(0, 8)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
